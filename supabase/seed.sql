-- Sample Data for Toronto Language Exchange
--
-- IMPORTANT: Before running this script, create the following users via Supabase Dashboard or signup page:
-- 1. student1@example.com (password: password123)
-- 2. teacher1@example.com (password: password123)
-- 3. teacher2@example.com (password: password123)
--
-- After creating users, update the UUIDs below with the actual user IDs from auth.users table

-- Replace these UUIDs with actual user IDs from your auth.users table
-- You can find them in Supabase Dashboard > Authentication > Users
DO $$
DECLARE
  student1_id UUID := '00000000-0000-0000-0000-000000000001'; -- Replace with actual student1@example.com user ID
  teacher1_id UUID := '00000000-0000-0000-0000-000000000002'; -- Replace with actual teacher1@example.com user ID
  teacher2_id UUID := '00000000-0000-0000-0000-000000000003'; -- Replace with actual teacher2@example.com user ID
  match1_id UUID;
  match2_id UUID;
BEGIN
  -- Insert profiles
  INSERT INTO profiles (id, email, full_name, role, created_at, updated_at) VALUES
    (student1_id, 'student1@example.com', '田中 太郎', 'student', NOW(), NOW()),
    (teacher1_id, 'teacher1@example.com', '佐藤 花子', 'teacher', NOW(), NOW()),
    (teacher2_id, 'teacher2@example.com', 'John Smith', 'teacher', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW();

  -- Insert student profile
  INSERT INTO student_profiles (user_id, bio, learning_goals, desired_teacher_type, japanese_level, availability, location, created_at, updated_at) VALUES
    (
      student1_id,
      'Hello! I am learning Japanese and looking for a friendly teacher to practice conversation.',
      'I want to improve my conversational Japanese skills and prepare for JLPT N3.',
      'Patient and encouraging teacher who can help with daily conversation',
      'intermediate',
      'Weekday evenings and weekends',
      'Toronto, ON',
      NOW(),
      NOW()
    )
  ON CONFLICT (user_id) DO UPDATE SET
    bio = EXCLUDED.bio,
    learning_goals = EXCLUDED.learning_goals,
    desired_teacher_type = EXCLUDED.desired_teacher_type,
    japanese_level = EXCLUDED.japanese_level,
    availability = EXCLUDED.availability,
    location = EXCLUDED.location,
    updated_at = NOW();

  -- Insert teacher profiles
  INSERT INTO teacher_profiles (user_id, bio, teaching_experience, specialties, location, created_at, updated_at) VALUES
    (
      teacher1_id,
      'こんにちは！I have 5 years of experience teaching Japanese to English speakers.',
      '5 years of teaching experience at language schools in Toronto',
      ARRAY['Conversation', 'Grammar', 'JLPT Preparation'],
      'Toronto, ON',
      NOW(),
      NOW()
    ),
    (
      teacher2_id,
      'Native English speaker who learned Japanese and can help bridge the gap!',
      '3 years of teaching experience, specialized in beginner to intermediate levels',
      ARRAY['Conversation', 'Business Japanese', 'Cultural Exchange'],
      'Toronto, ON',
      NOW(),
      NOW()
    )
  ON CONFLICT (user_id) DO UPDATE SET
    bio = EXCLUDED.bio,
    teaching_experience = EXCLUDED.teaching_experience,
    specialties = EXCLUDED.specialties,
    location = EXCLUDED.location,
    updated_at = NOW();

  -- Insert matches
  INSERT INTO matches (teacher_id, student_id, status, created_at, updated_at) VALUES
    (teacher1_id, student1_id, 'active', NOW() - INTERVAL '7 days', NOW())
  ON CONFLICT (teacher_id, student_id) DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = NOW()
  RETURNING id INTO match1_id;

  INSERT INTO matches (teacher_id, student_id, status, created_at, updated_at) VALUES
    (teacher2_id, student1_id, 'active', NOW() - INTERVAL '3 days', NOW())
  ON CONFLICT (teacher_id, student_id) DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = NOW()
  RETURNING id INTO match2_id;

  -- Get match IDs if they already existed
  IF match1_id IS NULL THEN
    SELECT id INTO match1_id FROM matches WHERE teacher_id = teacher1_id AND student_id = student1_id;
  END IF;

  IF match2_id IS NULL THEN
    SELECT id INTO match2_id FROM matches WHERE teacher_id = teacher2_id AND student_id = student1_id;
  END IF;

  -- Insert messages for match 1
  INSERT INTO messages (match_id, sender_id, content, is_read, created_at) VALUES
    (match1_id, teacher1_id, 'こんにちは！よろしくお願いします。', true, NOW() - INTERVAL '7 days'),
    (match1_id, student1_id, 'Hello! Thank you for accepting my request. When would be a good time to meet?', true, NOW() - INTERVAL '6 days' - INTERVAL '2 hours'),
    (match1_id, teacher1_id, 'How about this Saturday at 2pm? We can meet at the library near Yonge-Bloor station.', true, NOW() - INTERVAL '6 days'),
    (match1_id, student1_id, 'That sounds perfect! See you then.', true, NOW() - INTERVAL '5 days' - INTERVAL '3 hours'),
    (match1_id, teacher1_id, '楽しみにしています！', false, NOW() - INTERVAL '5 days');

  -- Insert messages for match 2
  INSERT INTO messages (match_id, sender_id, content, is_read, created_at) VALUES
    (match2_id, teacher2_id, 'Hi! I would love to help you with your Japanese studies.', true, NOW() - INTERVAL '3 days'),
    (match2_id, student1_id, 'Thank you! I am particularly interested in business Japanese. Can you help with that?', true, NOW() - INTERVAL '2 days' - INTERVAL '5 hours'),
    (match2_id, teacher2_id, 'Absolutely! I specialize in business Japanese. Let me know your availability.', false, NOW() - INTERVAL '2 days');

  RAISE NOTICE 'Sample data inserted successfully!';
  RAISE NOTICE 'Match 1 ID: %', match1_id;
  RAISE NOTICE 'Match 2 ID: %', match2_id;
END $$;
