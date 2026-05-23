-- Notifications schema
-- Run this in Supabase SQL Editor

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,           -- e.g. 'announcement_new', 'message_new', 'comment_new', 'match_new', 'booking_new', 'booking_cancelled', 'booking_paid', 'reminder_3d', 'reminder_24h', 'student_registered', 'announcement_updated'
  title text not null,
  body text,
  link text,                    -- in-app path to navigate to, e.g. '/messages', '/announcements'
  metadata jsonb,               -- arbitrary payload (e.g. { announcement_id, message_id, booking_id })
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read)
  where is_read = false;

-- RLS
alter table public.notifications enable row level security;

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
on public.notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
on public.notifications for delete
to authenticated
using (user_id = auth.uid());

-- INSERT is restricted to server-side (service role) or database triggers via SECURITY DEFINER functions.
-- We intentionally do NOT grant insert to authenticated users — clients should not create notifications directly.

-- Enable Realtime for this table
-- (Run this in Supabase Dashboard > Database > Replication, or via SQL below)
alter publication supabase_realtime add table public.notifications;
