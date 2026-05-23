-- =====================================
-- Add max_participants to announcements
-- NULL = no limit (existing rows keep current behavior)
-- A trigger enforces the cap on INSERT to prevent races between
-- concurrent join clicks slipping past a client-side check.
-- =====================================

ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS max_participants integer
  CHECK (max_participants IS NULL OR max_participants > 0);

-- Trigger function: reject new like when announcement is full
CREATE OR REPLACE FUNCTION public.enforce_announcement_max_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap integer;
  current_count integer;
BEGIN
  SELECT max_participants INTO cap
  FROM public.announcements
  WHERE id = NEW.announcement_id;

  IF cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO current_count
  FROM public.announcement_likes
  WHERE announcement_id = NEW.announcement_id;

  IF current_count >= cap THEN
    RAISE EXCEPTION 'announcement_full'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_announcement_max_participants
  ON public.announcement_likes;

CREATE TRIGGER trg_enforce_announcement_max_participants
  BEFORE INSERT ON public.announcement_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_announcement_max_participants();
