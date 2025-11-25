-- =====================================
-- Announcements Feature (全体告知)
-- Admin announcements visible to all users
-- =====================================

-- =====================================
-- 1. ANNOUNCEMENTS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================
-- 2. INDEXES
-- =====================================

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_pinned ON public.announcements(is_pinned DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_user_id ON public.announcements(user_id);

-- =====================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =====================================

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Announcements policies: Anyone authenticated can read, only author can create/update/delete
DROP POLICY IF EXISTS "Authenticated users can read announcements" ON public.announcements;
CREATE POLICY "Authenticated users can read announcements"
  ON public.announcements FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Only admins can create announcements" ON public.announcements;
CREATE POLICY "Only admins can create announcements"
  ON public.announcements FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Only admins can update announcements" ON public.announcements;
CREATE POLICY "Only admins can update announcements"
  ON public.announcements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Only admins can delete announcements" ON public.announcements;
CREATE POLICY "Only admins can delete announcements"
  ON public.announcements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- =====================================
-- 4. ANNOUNCEMENT LIKES TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS public.announcement_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(announcement_id, user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_announcement_likes_announcement_id ON public.announcement_likes(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_likes_user_id ON public.announcement_likes(user_id);

-- Enable RLS
ALTER TABLE public.announcement_likes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read likes
DROP POLICY IF EXISTS "Authenticated users can read announcement likes" ON public.announcement_likes;
CREATE POLICY "Authenticated users can read announcement likes"
  ON public.announcement_likes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Anyone authenticated can like
DROP POLICY IF EXISTS "Authenticated users can like announcements" ON public.announcement_likes;
CREATE POLICY "Authenticated users can like announcements"
  ON public.announcement_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike their own likes
DROP POLICY IF EXISTS "Users can unlike announcements" ON public.announcement_likes;
CREATE POLICY "Users can unlike announcements"
  ON public.announcement_likes FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================
-- 5. REALTIME CONFIGURATION
-- =====================================

-- Enable realtime for announcements (skip if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
  END IF;
END $$;

-- Enable realtime for announcement_likes (skip if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'announcement_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_likes;
  END IF;
END $$;

-- =====================================
-- SETUP COMPLETE
-- =====================================
-- Run this file in Supabase SQL Editor to add announcements feature
-- =====================================
