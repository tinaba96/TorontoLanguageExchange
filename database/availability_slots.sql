-- 先生の空きスロットテーブル
CREATE TABLE IF NOT EXISTS public.availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked')),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT unique_teacher_slot UNIQUE (teacher_id, slot_date, start_time)
);

-- RLS 有効化
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

-- 誰でも読み取り可能
CREATE POLICY "availability_slots_select" ON public.availability_slots
  FOR SELECT USING (true);

-- 先生は自分のスロットを作成可能
CREATE POLICY "availability_slots_insert" ON public.availability_slots
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

-- 先生は自分のスロットを更新可能、マッチ済み生徒もavailableスロットのstatusを更新可能
CREATE POLICY "availability_slots_update" ON public.availability_slots
  FOR UPDATE USING (
    auth.uid() = teacher_id
    OR EXISTS (
      SELECT 1 FROM matches
      WHERE matches.teacher_id = availability_slots.teacher_id
        AND matches.student_id = auth.uid()
        AND matches.status = 'active'
    )
  );

-- 先生は自分のスロットを削除可能
CREATE POLICY "availability_slots_delete" ON public.availability_slots
  FOR DELETE USING (auth.uid() = teacher_id);
