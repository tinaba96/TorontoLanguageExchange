-- 予約テーブル
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  price_at_booking integer NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'confirmed', 'cancelled')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- RLS 有効化
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 予約の当事者（先生・生徒）のみ閲覧可能
CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT USING (auth.uid() = student_id OR auth.uid() = teacher_id);

-- 生徒のみ予約作成可能
CREATE POLICY "bookings_insert" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = student_id);

-- 当事者のみ予約更新可能
CREATE POLICY "bookings_update" ON public.bookings
  FOR UPDATE USING (auth.uid() = student_id OR auth.uid() = teacher_id);
