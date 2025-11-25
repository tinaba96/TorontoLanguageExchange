-- =====================================
-- Add Admin Role to Profiles
-- =====================================

-- 1. Add is_admin column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false NOT NULL;

-- 2. Create index for admin lookup
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- =====================================
-- HOW TO MAKE A USER ADMIN
-- =====================================
-- Run this query with the user's email:
--
-- UPDATE public.profiles
-- SET is_admin = true
-- WHERE email = 'admin@example.com';
--
-- Or by user ID:
--
-- UPDATE public.profiles
-- SET is_admin = true
-- WHERE id = 'user-uuid-here';
--
-- =====================================
-- TO CHECK ADMIN USERS
-- =====================================
-- SELECT id, email, full_name, role, is_admin
-- FROM public.profiles
-- WHERE is_admin = true;
-- =====================================
