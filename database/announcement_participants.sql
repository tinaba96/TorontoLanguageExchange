-- =====================================
-- Add participant_name and participant_email to announcement_likes
-- for anonymous participants
-- =====================================

ALTER TABLE public.announcement_likes
ADD COLUMN IF NOT EXISTS participant_name text,
ADD COLUMN IF NOT EXISTS participant_email text;
