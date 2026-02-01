-- =====================================
-- Anonymous Posts Support
-- =====================================

-- 1. Add author_name column for anonymous posts
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS author_name text;

ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS author_name text;

-- 2. Make user_id nullable for anonymous posts
ALTER TABLE public.posts
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.comments
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.post_likes
ALTER COLUMN user_id DROP NOT NULL;

-- 3. Update RLS policies to allow anonymous posts
-- Posts: Allow anyone to read
DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
CREATE POLICY "Anyone can read posts"
  ON public.posts FOR SELECT
  USING (true);

-- Posts: Allow anyone to insert
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
CREATE POLICY "Anyone can create posts"
  ON public.posts FOR INSERT
  WITH CHECK (true);

-- Comments: Allow anyone to read
DROP POLICY IF EXISTS "Anyone can read comments" ON public.comments;
CREATE POLICY "Anyone can read comments"
  ON public.comments FOR SELECT
  USING (true);

-- Comments: Allow anyone to insert
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
CREATE POLICY "Anyone can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (true);

-- Likes: Allow anyone to read
DROP POLICY IF EXISTS "Anyone can read likes" ON public.post_likes;
CREATE POLICY "Anyone can read likes"
  ON public.post_likes FOR SELECT
  USING (true);

-- Likes: Allow anyone to insert
DROP POLICY IF EXISTS "Authenticated users can like posts" ON public.post_likes;
CREATE POLICY "Anyone can like posts"
  ON public.post_likes FOR INSERT
  WITH CHECK (true);

-- Likes: Allow anyone to delete
DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;
CREATE POLICY "Anyone can unlike posts"
  ON public.post_likes FOR DELETE
  USING (true);

-- =====================================
-- Announcements: Update policies for anonymous access
-- =====================================

-- Allow anyone to read announcements
DROP POLICY IF EXISTS "Authenticated users can read announcements" ON public.announcements;
CREATE POLICY "Anyone can read announcements"
  ON public.announcements FOR SELECT
  USING (true);

-- Allow anyone to read announcement likes
DROP POLICY IF EXISTS "Authenticated users can read announcement likes" ON public.announcement_likes;
CREATE POLICY "Anyone can read announcement likes"
  ON public.announcement_likes FOR SELECT
  USING (true);

-- Make announcement_likes user_id nullable
ALTER TABLE public.announcement_likes
ALTER COLUMN user_id DROP NOT NULL;

-- Allow anyone to like announcements
DROP POLICY IF EXISTS "Authenticated users can like announcements" ON public.announcement_likes;
CREATE POLICY "Anyone can like announcements"
  ON public.announcement_likes FOR INSERT
  WITH CHECK (true);

-- Allow anyone to unlike
DROP POLICY IF EXISTS "Users can unlike announcements" ON public.announcement_likes;
CREATE POLICY "Anyone can unlike announcements"
  ON public.announcement_likes FOR DELETE
  USING (true);

-- =====================================
-- Admin can delete any posts/comments
-- =====================================

-- Posts: Admin can delete any post
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
CREATE POLICY "Users or admin can delete posts"
  ON public.posts FOR DELETE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Comments: Admin can delete any comment
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users or admin can delete comments"
  ON public.comments FOR DELETE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- =====================================
-- Run this in Supabase SQL Editor
-- =====================================
