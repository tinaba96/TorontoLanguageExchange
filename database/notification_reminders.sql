-- Lesson reminders (3 days before + 24 hours before)
-- Run AFTER notifications.sql and notification_triggers.sql in Supabase SQL Editor.
-- Requires pg_cron extension. Supabase ダッシュボード:
--   Database > Extensions > 'pg_cron' を有効化してから実行してください。
--
-- Time zone assumption: slots are stored as local Toronto wall-clock time
-- (slot_date date + start_time time). Adjust 'America/Toronto' below if you
-- want a different lesson timezone.

-- =========================================================================
-- 1. Track which reminders have already been sent per booking.
-- =========================================================================
alter table public.bookings
  add column if not exists reminder_3d_sent boolean not null default false,
  add column if not exists reminder_24h_sent boolean not null default false;

-- =========================================================================
-- 2. Worker function: scan bookings, send overdue reminders, mark sent.
--    Idempotent — safe to run multiple times because of the sent flags.
-- =========================================================================
create or replace function public.send_lesson_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'America/Toronto';
begin
  -- 3-day reminders: fire when lesson is between 71h and 73h away.
  -- Mark first, fan-out from the returned rows so we never double-send.
  with eligible as (
    select b.id, b.student_id, b.teacher_id,
           ((s.slot_date + s.start_time)::timestamp at time zone v_tz) as lesson_at
    from public.bookings b
    join public.availability_slots s on s.id = b.slot_id
    where b.status = 'confirmed'
      and b.reminder_3d_sent = false
      and ((s.slot_date + s.start_time)::timestamp at time zone v_tz)
            between (now() + interval '71 hours') and (now() + interval '73 hours')
  ),
  marked as (
    update public.bookings b
    set reminder_3d_sent = true
    from eligible e
    where b.id = e.id
    returning b.id, e.student_id, e.teacher_id, e.lesson_at
  )
  insert into public.notifications (user_id, type, title, body, link, metadata)
  select
    r.recipient,
    'reminder_3d',
    '3日後のレッスン',
    to_char(m.lesson_at at time zone v_tz, 'YYYY/MM/DD HH24:MI') || ' のレッスンが3日後です',
    '/messages',
    jsonb_build_object('booking_id', m.id)
  from marked m
  cross join lateral (values (m.student_id), (m.teacher_id)) as r(recipient);

  -- 24h reminders: fire when lesson is between 23h and 25h away.
  with eligible as (
    select b.id, b.student_id, b.teacher_id,
           ((s.slot_date + s.start_time)::timestamp at time zone v_tz) as lesson_at
    from public.bookings b
    join public.availability_slots s on s.id = b.slot_id
    where b.status = 'confirmed'
      and b.reminder_24h_sent = false
      and ((s.slot_date + s.start_time)::timestamp at time zone v_tz)
            between (now() + interval '23 hours') and (now() + interval '25 hours')
  ),
  marked as (
    update public.bookings b
    set reminder_24h_sent = true
    from eligible e
    where b.id = e.id
    returning b.id, e.student_id, e.teacher_id, e.lesson_at
  )
  insert into public.notifications (user_id, type, title, body, link, metadata)
  select
    r.recipient,
    'reminder_24h',
    '明日のレッスン',
    to_char(m.lesson_at at time zone v_tz, 'YYYY/MM/DD HH24:MI') || ' のレッスンまで24時間です',
    '/messages',
    jsonb_build_object('booking_id', m.id)
  from marked m
  cross join lateral (values (m.student_id), (m.teacher_id)) as r(recipient);
end;
$$;

-- =========================================================================
-- 3. Schedule via pg_cron — every 30 minutes.
--    Window is 2h wide so we always catch each booking at least once even
--    if a cron run is delayed.
-- =========================================================================
create extension if not exists pg_cron;

-- Remove old schedule if it exists, then re-schedule.
select cron.unschedule(jobid)
from cron.job where jobname = 'send-lesson-reminders';

select cron.schedule(
  'send-lesson-reminders',
  '*/30 * * * *',
  $$select public.send_lesson_reminders();$$
);
