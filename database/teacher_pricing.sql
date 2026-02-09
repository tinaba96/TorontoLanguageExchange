-- teacher_profiles に hourly_rate カラムを追加
-- 整数（セント単位）: 3000 = $30.00 CAD
ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS hourly_rate integer DEFAULT NULL;
