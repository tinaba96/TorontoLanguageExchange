-- Notification triggers
-- Run AFTER notifications.sql in Supabase SQL Editor
-- Idempotent: re-running drops and re-creates triggers/functions.

-- =========================================================================
-- Helper: create a single notification (SECURITY DEFINER bypasses RLS so
-- triggers can insert into notifications on behalf of any user).
-- =========================================================================
create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_metadata jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link, metadata)
  values (p_user_id, p_type, p_title, p_body, p_link, p_metadata);
end;
$$;

-- =========================================================================
-- 1. announcement_new: fan out to all profiles except the author
-- =========================================================================
create or replace function public.notify_announcement_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link, metadata)
  select
    p.id,
    'announcement_new',
    '新しい告知: ' || new.title,
    null,
    '/announcements',
    jsonb_build_object('announcement_id', new.id)
  from public.profiles p
  where p.id <> new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_notify_announcement_new on public.announcements;
create trigger trg_notify_announcement_new
after insert on public.announcements
for each row execute function public.notify_announcement_new();

-- =========================================================================
-- 2. announcement_updated: notify participants (announcement_likes with user_id)
--    when title or content changes
-- =========================================================================
create or replace function public.notify_announcement_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.title is distinct from old.title or new.content is distinct from old.content then
    insert into public.notifications (user_id, type, title, body, link, metadata)
    select distinct
      al.user_id,
      'announcement_updated',
      '参加中のイベントが更新されました',
      new.title,
      '/announcements',
      jsonb_build_object('announcement_id', new.id)
    from public.announcement_likes al
    where al.announcement_id = new.id
      and al.user_id is not null
      and al.user_id <> new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_announcement_updated on public.announcements;
create trigger trg_notify_announcement_updated
after update on public.announcements
for each row execute function public.notify_announcement_updated();

-- =========================================================================
-- 3. announcement_deleted: notify participants BEFORE the cascade nukes them
-- =========================================================================
create or replace function public.notify_announcement_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link, metadata)
  select distinct
    al.user_id,
    'announcement_deleted',
    '参加中のイベントが削除されました',
    old.title,
    '/announcements',
    jsonb_build_object('announcement_id', old.id)
  from public.announcement_likes al
  where al.announcement_id = old.id
    and al.user_id is not null
    and al.user_id <> old.user_id;
  return old;
end;
$$;

drop trigger if exists trg_notify_announcement_deleted on public.announcements;
create trigger trg_notify_announcement_deleted
before delete on public.announcements
for each row execute function public.notify_announcement_deleted();

-- =========================================================================
-- 4. message_new: notify the other party in the match
-- =========================================================================
create or replace function public.notify_message_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_student_id uuid;
  v_recipient uuid;
  v_sender_name text;
begin
  select teacher_id, student_id into v_teacher_id, v_student_id
  from public.matches where id = new.match_id;

  if v_teacher_id is null then return new; end if;

  if new.sender_id = v_teacher_id then
    v_recipient := v_student_id;
  else
    v_recipient := v_teacher_id;
  end if;

  select full_name into v_sender_name from public.profiles where id = new.sender_id;

  insert into public.notifications (user_id, type, title, body, link, metadata)
  values (
    v_recipient,
    'message_new',
    coalesce(v_sender_name, '相手') || ' からメッセージが届きました',
    left(new.content, 100),
    '/messages',
    jsonb_build_object('match_id', new.match_id, 'message_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_message_new on public.messages;
create trigger trg_notify_message_new
after insert on public.messages
for each row execute function public.notify_message_new();

-- =========================================================================
-- 5. comment_new: notify post owner (skip self-comments and anonymous owners)
-- =========================================================================
create or replace function public.notify_comment_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_owner uuid;
  v_post_title text;
  v_commenter_name text;
begin
  select user_id, title into v_post_owner, v_post_title
  from public.posts where id = new.post_id;

  if v_post_owner is null then return new; end if;
  if new.user_id is not null and v_post_owner = new.user_id then return new; end if;

  if new.user_id is not null then
    select full_name into v_commenter_name from public.profiles where id = new.user_id;
  end if;

  insert into public.notifications (user_id, type, title, body, link, metadata)
  values (
    v_post_owner,
    'comment_new',
    coalesce(v_commenter_name, 'ゲスト') || ' があなたの投稿にコメントしました',
    coalesce(v_post_title, '') || ' / ' || left(new.content, 80),
    '/board',
    jsonb_build_object('post_id', new.post_id, 'comment_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_comment_new on public.comments;
create trigger trg_notify_comment_new
after insert on public.comments
for each row execute function public.notify_comment_new();

-- =========================================================================
-- 6. match_new: notify the student that a teacher matched them
-- =========================================================================
create or replace function public.notify_match_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_name text;
begin
  select full_name into v_teacher_name from public.profiles where id = new.teacher_id;

  insert into public.notifications (user_id, type, title, body, link, metadata)
  values (
    new.student_id,
    'match_new',
    coalesce(v_teacher_name, '先生') || ' とマッチングしました',
    'メッセージを送って交流を始めましょう',
    '/messages',
    jsonb_build_object('match_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_match_new on public.matches;
create trigger trg_notify_match_new
after insert on public.matches
for each row execute function public.notify_match_new();

-- =========================================================================
-- 7. booking_new: notify the teacher of an incoming booking
-- =========================================================================
create or replace function public.notify_booking_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_name text;
  v_slot_date date;
  v_start_time time;
begin
  select full_name into v_student_name from public.profiles where id = new.student_id;
  select slot_date, start_time into v_slot_date, v_start_time
  from public.availability_slots where id = new.slot_id;

  insert into public.notifications (user_id, type, title, body, link, metadata)
  values (
    new.teacher_id,
    'booking_new',
    coalesce(v_student_name, '生徒') || ' から予約が入りました',
    coalesce(to_char(v_slot_date, 'YYYY/MM/DD') || ' ' || to_char(v_start_time, 'HH24:MI'), ''),
    '/teacher',
    jsonb_build_object('booking_id', new.id, 'slot_id', new.slot_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_booking_new on public.bookings;
create trigger trg_notify_booking_new
after insert on public.bookings
for each row execute function public.notify_booking_new();

-- =========================================================================
-- 8. booking_status_changed:
--    pending_payment -> confirmed: notify student (paid/confirmed)
--    any -> cancelled: notify BOTH parties (we don't track who cancelled)
-- =========================================================================
create or replace function public.notify_booking_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_date date;
  v_start_time time;
  v_when text;
begin
  if new.status = old.status then return new; end if;

  select slot_date, start_time into v_slot_date, v_start_time
  from public.availability_slots where id = new.slot_id;
  v_when := coalesce(to_char(v_slot_date, 'YYYY/MM/DD') || ' ' || to_char(v_start_time, 'HH24:MI'), '');

  if new.status = 'confirmed' then
    insert into public.notifications (user_id, type, title, body, link, metadata)
    values (
      new.student_id,
      'booking_paid',
      '予約が確定しました',
      v_when,
      '/messages',
      jsonb_build_object('booking_id', new.id)
    );
  elsif new.status = 'cancelled' then
    -- Notify both parties; the one who cancelled will recognise their own action.
    insert into public.notifications (user_id, type, title, body, link, metadata)
    values
      (new.student_id, 'booking_cancelled', '予約がキャンセルされました', v_when, '/messages',
        jsonb_build_object('booking_id', new.id)),
      (new.teacher_id, 'booking_cancelled', '予約がキャンセルされました', v_when, '/messages',
        jsonb_build_object('booking_id', new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_booking_status_changed on public.bookings;
create trigger trg_notify_booking_status_changed
after update of status on public.bookings
for each row execute function public.notify_booking_status_changed();

-- =========================================================================
-- 9. student_registered: notify every teacher
-- =========================================================================
create or replace function public.notify_student_registered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> 'student' then return new; end if;

  insert into public.notifications (user_id, type, title, body, link, metadata)
  select
    p.id,
    'student_registered',
    '新しい生徒が登録されました',
    coalesce(new.full_name, '名前未設定'),
    '/students',
    jsonb_build_object('student_id', new.id)
  from public.profiles p
  where p.role = 'teacher' and p.id <> new.id;
  return new;
end;
$$;

drop trigger if exists trg_notify_student_registered on public.profiles;
create trigger trg_notify_student_registered
after insert on public.profiles
for each row execute function public.notify_student_registered();
