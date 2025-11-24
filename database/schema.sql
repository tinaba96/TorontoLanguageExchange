-- =====================================
-- Toronto Language Exchange Database Schema
-- Complete backup for disaster recovery
-- =====================================

-- =====================================
-- 1. TABLES
-- =====================================

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL CHECK (role IN ('teacher', 'student')),
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Student profiles table
CREATE TABLE IF NOT EXISTS public.student_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  bio text,
  learning_goals text,
  desired_teacher_type text,
  japanese_level text CHECK (japanese_level IN ('beginner', 'intermediate', 'advanced')),
  availability text,
  location text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Teacher profiles table
CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  bio text,
  teaching_experience text,
  specialties text[],
  location text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Matches table
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(teacher_id, student_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================
-- 2. INDEXES
-- =====================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Student profiles indexes
CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id ON public.student_profiles(user_id);

-- Teacher profiles indexes
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_user_id ON public.teacher_profiles(user_id);

-- Matches indexes
CREATE INDEX IF NOT EXISTS idx_matches_teacher_id ON public.matches(teacher_id);
CREATE INDEX IF NOT EXISTS idx_matches_student_id ON public.matches(student_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON public.messages(match_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- =====================================
-- 3. TRIGGERS AND FUNCTIONS
-- =====================================

-- Function: Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role text;
  user_full_name text;
BEGIN
  -- Get role (default: student)
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'student');

  -- Get full name (handle empty strings)
  user_full_name := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'full_name', '')), '');

  -- Log for debugging
  RAISE LOG 'Creating profile for user: %, role: %, name: %', new.id, user_role, user_full_name;

  -- Insert into profiles table
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    user_full_name,
    user_role
  );

  -- Insert into role-specific profile table
  IF user_role = 'teacher' THEN
    INSERT INTO public.teacher_profiles (user_id)
    VALUES (new.id);
    RAISE LOG 'Created teacher profile for user: %', new.id;
  ELSE
    INSERT INTO public.student_profiles (user_id)
    VALUES (new.id);
    RAISE LOG 'Created student profile for user: %', new.id;
  END IF;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user for user %: %', new.id, SQLERRM;
    RAISE;
END;
$$;

-- Trigger: Create profile on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
CREATE POLICY "Anyone can read profiles"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Student profiles policies
DROP POLICY IF EXISTS "Anyone can read student profiles" ON public.student_profiles;
CREATE POLICY "Anyone can read student profiles"
  ON public.student_profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Students can update own profile" ON public.student_profiles;
CREATE POLICY "Students can update own profile"
  ON public.student_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Teacher profiles policies
DROP POLICY IF EXISTS "Anyone can read teacher profiles" ON public.teacher_profiles;
CREATE POLICY "Anyone can read teacher profiles"
  ON public.teacher_profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Teachers can update own profile" ON public.teacher_profiles;
CREATE POLICY "Teachers can update own profile"
  ON public.teacher_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Matches policies
DROP POLICY IF EXISTS "Users can read their matches" ON public.matches;
CREATE POLICY "Users can read their matches"
  ON public.matches FOR SELECT
  USING (
    auth.uid() = teacher_id OR auth.uid() = student_id
  );

DROP POLICY IF EXISTS "Teachers can create matches" ON public.matches;
CREATE POLICY "Teachers can create matches"
  ON public.matches FOR INSERT
  WITH CHECK (
    auth.uid() = teacher_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

DROP POLICY IF EXISTS "Users can update their matches" ON public.matches;
CREATE POLICY "Users can update their matches"
  ON public.matches FOR UPDATE
  USING (auth.uid() = teacher_id OR auth.uid() = student_id);

-- Messages policies
DROP POLICY IF EXISTS "Users can read messages in their matches" ON public.messages;
CREATE POLICY "Users can read messages in their matches"
  ON public.messages FOR SELECT
  USING (
    auth.uid() IN (
      SELECT teacher_id FROM matches WHERE id = match_id
      UNION
      SELECT student_id FROM matches WHERE id = match_id
    )
  );

DROP POLICY IF EXISTS "Users can send messages in their matches" ON public.messages;
CREATE POLICY "Users can send messages in their matches"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    auth.uid() IN (
      SELECT teacher_id FROM matches WHERE id = match_id
      UNION
      SELECT student_id FROM matches WHERE id = match_id
    )
  );

-- =====================================
-- 5. REALTIME CONFIGURATION
-- =====================================

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- =====================================
-- SETUP COMPLETE
-- =====================================
-- To restore from this backup:
-- 1. Run this entire file in Supabase SQL Editor
-- 2. Verify with: SELECT * FROM information_schema.tables WHERE table_schema = 'public';
-- 3. Test user signup to verify trigger is working
-- =====================================
