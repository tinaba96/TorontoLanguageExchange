-- =====================================
-- Notification triggers — Payment-aware extension
--
-- Run AFTER notifications.sql, notification_triggers.sql, payment.sql.
-- Idempotent: drops + recreates the two functions/triggers.
--
-- Adds:
--   1. Admin recipients on every booking event.
--   2. Status transitions for 'paid', 'confirmed', 'refunded'.
--   3. Teacher gets notified on payment success (was student-only before).
-- =====================================

-- =========================================================================
-- Replaces: notify_booking_new
--   Original behaviour: teacher gets one notification.
--   New behaviour:      teacher + all admins (admins want operational visibility
--                       even for pending_payment bookings since unpaid → stale).
-- =========================================================================
create or replace function public.notify_booking_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_name text;
  v_slot_date date;
  v_start_time time;
  v_when text;
begin
  select full_name into v_student_name from public.profiles where id = new.student_id;
  select slot_date, start_time into v_slot_date, v_start_time
  from public.availability_slots where id = new.slot_id;
  v_when := coalesce(to_char(v_slot_date, 'YYYY/MM/DD') || ' ' || to_char(v_start_time, 'HH24:MI'), '');

  -- Teacher: incoming booking
  insert into public.notifications (user_id, type, title, body, link, metadata)
  values (
    new.teacher_id,
    'booking_new',
    coalesce(v_student_name, '生徒') || ' から予約が入りました',
    v_when || ' (決済待ち)',
    '/students',
    jsonb_build_object('booking_id', new.id, 'slot_id', new.slot_id, 'status', new.status)
  );

  -- Admins: operational log
  insert into public.notifications (user_id, type, title, body, link, metadata)
  select
    p.id,
    'admin_booking_new',
    '[管理] 新しい予約',
    coalesce(v_student_name, '生徒') || ' → 先生 / ' || v_when || ' (決済待ち)',
    '/settings',
    jsonb_build_object('booking_id', new.id, 'student_id', new.student_id, 'teacher_id', new.teacher_id, 'slot_id', new.slot_id)
  from public.profiles p
  where p.is_admin = true
    and p.id <> new.student_id
    and p.id <> new.teacher_id;

  return new;
end;
$$;

drop trigger if exists trg_notify_booking_new on public.bookings;
create trigger trg_notify_booking_new
after insert on public.bookings
for each row execute function public.notify_booking_new();


-- =========================================================================
-- Replaces: notify_booking_status_changed
--   Original behaviour: only 'confirmed' (→ student) and 'cancelled' (→ both).
--   New behaviour:
--     'paid' or 'confirmed' → student + teacher + admins (payment success)
--     'cancelled'           → student + teacher + admins
--     'refunded'            → student + teacher + admins
-- =========================================================================
create or replace function public.notify_booking_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_name text;
  v_teacher_name text;
  v_slot_date date;
  v_start_time time;
  v_when text;
  v_amount integer;
  v_amount_str text;
begin
  if new.status = old.status then return new; end if;

  select full_name into v_student_name from public.profiles where id = new.student_id;
  select full_name into v_teacher_name from public.profiles where id = new.teacher_id;
  select slot_date, start_time into v_slot_date, v_start_time
  from public.availability_slots where id = new.slot_id;
  v_when := coalesce(to_char(v_slot_date, 'YYYY/MM/DD') || ' ' || to_char(v_start_time, 'HH24:MI'), '');
  v_amount := new.price_at_booking;
  v_amount_str := '$' || to_char(v_amount::numeric / 100.0, 'FM999990.00') || ' CAD';

  -- ========== PAID / CONFIRMED — payment success ==========
  if new.status in ('paid', 'confirmed') then
    -- Student: payment confirmed
    insert into public.notifications (user_id, type, title, body, link, metadata)
    values (
      new.student_id,
      'booking_paid',
      '決済が完了しました',
      v_when || ' / ' || v_amount_str,
      '/messages',
      jsonb_build_object('booking_id', new.id)
    );

    -- Teacher: lesson is locked in + payout amount
    insert into public.notifications (user_id, type, title, body, link, metadata)
    values (
      new.teacher_id,
      'booking_paid',
      coalesce(v_student_name, '生徒') || ' の予約が確定しました',
      v_when || ' / 受取予定: $' ||
        to_char(coalesce(new.teacher_payout_amount, 0)::numeric / 100.0, 'FM999990.00') || ' CAD',
      '/students',
      jsonb_build_object('booking_id', new.id)
    );

    -- Admins: revenue event
    insert into public.notifications (user_id, type, title, body, link, metadata)
    select
      p.id,
      'admin_booking_paid',
      '[管理] 決済完了',
      coalesce(v_student_name, '生徒') || ' → ' || coalesce(v_teacher_name, '先生') || ' / ' ||
        v_when || ' / ' || v_amount_str,
      '/settings',
      jsonb_build_object(
        'booking_id', new.id,
        'student_id', new.student_id,
        'teacher_id', new.teacher_id,
        'amount_cents', new.price_at_booking,
        'teacher_payout_cents', new.teacher_payout_amount,
        'platform_cents', new.platform_amount,
        'system_cents', new.system_amount
      )
    from public.profiles p
    where p.is_admin = true
      and p.id <> new.student_id
      and p.id <> new.teacher_id;

  -- ========== CANCELLED ==========
  elsif new.status = 'cancelled' then
    insert into public.notifications (user_id, type, title, body, link, metadata)
    values
      (new.student_id, 'booking_cancelled', '予約がキャンセルされました', v_when, '/messages',
        jsonb_build_object('booking_id', new.id)),
      (new.teacher_id, 'booking_cancelled', '予約がキャンセルされました', v_when, '/students',
        jsonb_build_object('booking_id', new.id));

    insert into public.notifications (user_id, type, title, body, link, metadata)
    select
      p.id,
      'admin_booking_cancelled',
      '[管理] 予約キャンセル',
      coalesce(v_student_name, '生徒') || ' / ' || coalesce(v_teacher_name, '先生') || ' / ' || v_when,
      '/settings',
      jsonb_build_object('booking_id', new.id)
    from public.profiles p
    where p.is_admin = true
      and p.id <> new.student_id
      and p.id <> new.teacher_id;

  -- ========== REFUNDED ==========
  elsif new.status = 'refunded' then
    insert into public.notifications (user_id, type, title, body, link, metadata)
    values
      (new.student_id, 'booking_refunded', '返金が完了しました',
        v_when || ' / ' || v_amount_str, '/messages',
        jsonb_build_object('booking_id', new.id)),
      (new.teacher_id, 'booking_refunded', '予約が返金されました',
        v_when || ' / ' || v_amount_str, '/students',
        jsonb_build_object('booking_id', new.id));

    insert into public.notifications (user_id, type, title, body, link, metadata)
    select
      p.id,
      'admin_booking_refunded',
      '[管理] 返金処理',
      coalesce(v_student_name, '生徒') || ' / ' || coalesce(v_teacher_name, '先生') || ' / ' ||
        v_when || ' / ' || v_amount_str,
      '/settings',
      jsonb_build_object('booking_id', new.id, 'amount_cents', new.price_at_booking)
    from public.profiles p
    where p.is_admin = true
      and p.id <> new.student_id
      and p.id <> new.teacher_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_booking_status_changed on public.bookings;
create trigger trg_notify_booking_status_changed
after update of status on public.bookings
for each row execute function public.notify_booking_status_changed();
