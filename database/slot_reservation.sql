-- =====================================
-- Slot reservation + payment expiry
--
-- Solves three problems with the old "book first, pay later" flow:
--   1. Teachers were notified before payment (false positives).
--   2. Two students could pick the same slot and both succeed.
--   3. Abandoned pending_payment bookings hung around forever.
--
-- New design:
--   - "予約する" atomically locks the slots (status='reserved')
--     for 15 minutes via reserve_slots_for_booking() RPC.
--   - bookings.expires_at marks the payment deadline.
--   - cleanup_expired_pending_bookings() runs every 5 min via pg_cron:
--       cancels expired bookings and frees their slots back to 'available'.
--   - notify_booking_new no longer fires on status='pending_payment',
--     so teachers/admins only hear about a booking once it's actually paid.
--
-- Run AFTER payment.sql and notification_triggers_payment.sql.
-- Idempotent.
-- =====================================

-- ---------------------------------------------------------------------------
-- 1. Schema changes
-- ---------------------------------------------------------------------------

ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS reserved_until timestamptz;

-- Allow 'reserved' as a transient state between available and booked.
ALTER TABLE public.availability_slots
  DROP CONSTRAINT IF EXISTS availability_slots_status_check;
ALTER TABLE public.availability_slots
  ADD CONSTRAINT availability_slots_status_check
  CHECK (status IN ('available', 'reserved', 'booked'));

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bookings_pending_expires
  ON public.bookings(expires_at)
  WHERE status = 'pending_payment';

CREATE INDEX IF NOT EXISTS idx_slots_reserved_until
  ON public.availability_slots(reserved_until)
  WHERE status = 'reserved';

-- ---------------------------------------------------------------------------
-- 2. RPC: reserve_slots_for_booking
--
-- One atomic transaction:
--   - locks all requested slots if they are currently 'available'
--   - inserts one bookings row per slot with status='pending_payment'
--   - returns the new booking ids
--
-- Raises 'slot_unavailable' if any of the slots is not 'available'.
-- The whole transaction rolls back on failure, so a partial lock can
-- never leak.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_slots_for_booking(
  p_match_id uuid,
  p_slot_ids uuid[],
  p_student_id uuid,
  p_teacher_id uuid,
  p_price_at_booking integer,
  p_hold_minutes integer DEFAULT 15
)
RETURNS TABLE (booking_id uuid, slot_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at timestamptz := now() + make_interval(mins => p_hold_minutes);
  v_locked_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_student_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Lock the slots, only if they are still 'available'.
  UPDATE public.availability_slots
  SET status = 'reserved',
      reserved_until = v_expires_at
  WHERE id = ANY(p_slot_ids)
    AND status = 'available'
    AND teacher_id = p_teacher_id;

  GET DIAGNOSTICS v_locked_count = ROW_COUNT;
  IF v_locked_count <> array_length(p_slot_ids, 1) THEN
    RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = '23505';
  END IF;

  -- Insert bookings and stream back the (booking_id, slot_id) pairs.
  RETURN QUERY
  INSERT INTO public.bookings (
    match_id, slot_id, student_id, teacher_id,
    price_at_booking, status, expires_at
  )
  SELECT
    p_match_id, sid, p_student_id, p_teacher_id,
    p_price_at_booking, 'pending_payment', v_expires_at
  FROM unnest(p_slot_ids) AS sid
  RETURNING bookings.id, bookings.slot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_slots_for_booking(uuid, uuid[], uuid, uuid, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Cleanup function (cron-driven)
--
-- Hard-DELETEs expired pending_payment bookings and frees their slots back to
-- 'available'. DELETE (rather than UPDATE → 'cancelled') is intentional:
--   - It matches the product invariant "no payment ⇒ no booking record".
--   - It avoids firing the notify_booking_status_changed trigger, which
--     would otherwise spam student/teacher/admins about a booking the user
--     simply abandoned.
--   - The webhook's phantom-payment branch (handlePhantomPayment) works
--     equally well with zero matching rows: it reads student/teacher info
--     from PaymentIntent.metadata.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freed_slots uuid[];
BEGIN
  -- 1-minute grace buffer in case a Stripe webhook is in flight.
  WITH expired AS (
    DELETE FROM public.bookings
    WHERE status = 'pending_payment'
      AND expires_at IS NOT NULL
      AND expires_at < now() - interval '1 minute'
    RETURNING slot_id
  )
  SELECT array_agg(slot_id) INTO v_freed_slots FROM expired;

  IF v_freed_slots IS NOT NULL THEN
    UPDATE public.availability_slots
    SET status = 'available', reserved_until = NULL
    WHERE id = ANY(v_freed_slots)
      AND status = 'reserved';  -- don't clobber already-booked slots
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Schedule cleanup via pg_cron (every 5 minutes)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule(jobid)
FROM cron.job WHERE jobname = 'cleanup-expired-pending-bookings';

SELECT cron.schedule(
  'cleanup-expired-pending-bookings',
  '*/5 * * * *',
  $$SELECT public.cleanup_expired_pending_bookings();$$
);

-- ---------------------------------------------------------------------------
-- 5. Replace notify_booking_new — skip notification for pending_payment
--
-- Bookings now always start as pending_payment, so this trigger essentially
-- becomes a no-op for the standard flow. notify_booking_status_changed
-- (defined in notification_triggers_payment.sql) handles the actual
-- "lesson confirmed" notification fan-out once Stripe confirms payment.
--
-- The trigger is kept (rather than dropped) so that any future direct-insert
-- path that creates a non-pending booking still notifies properly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_booking_new()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_name text;
  v_slot_date date;
  v_start_time time;
  v_when text;
BEGIN
  -- Don't notify yet — wait for the payment confirmation status change.
  IF new.status = 'pending_payment' THEN
    RETURN new;
  END IF;

  SELECT full_name INTO v_student_name FROM public.profiles WHERE id = new.student_id;
  SELECT slot_date, start_time INTO v_slot_date, v_start_time
  FROM public.availability_slots WHERE id = new.slot_id;
  v_when := COALESCE(to_char(v_slot_date, 'YYYY/MM/DD') || ' ' || to_char(v_start_time, 'HH24:MI'), '');

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    new.teacher_id,
    'booking_new',
    COALESCE(v_student_name, '生徒') || ' から予約が入りました',
    v_when,
    '/students',
    jsonb_build_object('booking_id', new.id, 'slot_id', new.slot_id, 'status', new.status)
  );

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT
    p.id,
    'admin_booking_new',
    '[管理] 新しい予約',
    COALESCE(v_student_name, '生徒') || ' / ' || v_when,
    '/settings',
    jsonb_build_object('booking_id', new.id, 'student_id', new.student_id, 'teacher_id', new.teacher_id)
  FROM public.profiles p
  WHERE p.is_admin = true
    AND p.id <> new.student_id
    AND p.id <> new.teacher_id;

  RETURN new;
END;
$$;

-- (the trigger trg_notify_booking_new already exists; the function body just changed)
