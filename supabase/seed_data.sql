-- サンプルデータ投入用SQL
-- 注意: このSQLは、auth.usersテーブルに直接ユーザーを作成できないため、
-- 実際のユーザー登録は画面から行ってください。
-- このSQLは、既存ユーザーのプロフィールデータを充実させるために使用します。

-- まず、UIから以下のユーザーを作成してください:
-- 1. 先生1: teacher1@example.com / password123
-- 2. 先生2: teacher2@example.com / password123
-- 3. 生徒1: student1@example.com / password123
-- 4. 生徒2: student2@example.com / password123
-- 5. 生徒3: student3@example.com / password123

-- 以下のSQLは、ユーザー作成後に実行してください

-- 生徒プロフィールの更新
-- 注意: user_idは実際に作成されたUUIDに置き換える必要があります

-- 生徒1のプロフィール更新例
-- UPDATE student_profiles
-- SET
--   bio = '初めまして！カナダに来て1年になります。日常会話を中心に学びたいです。',
--   learning_goals = 'カフェやレストランでの注文、買い物など、日常生活で使える日本語を学びたいです。',
--   desired_teacher_type = '優しくて、間違いを丁寧に訂正してくれる先生を探しています。',
--   japanese_level = 'beginner',
--   availability = '平日の夕方18:00以降、週末の午前中',
--   location = 'トロントダウンタウン'
-- WHERE user_id = 'USER_ID_HERE';

-- 生徒2のプロフィール更新例
-- UPDATE student_profiles
-- SET
--   bio = '日本のアニメや漫画が大好きです。N3レベルを目指して勉強中です。',
--   learning_goals = 'JLPT N3合格を目指しています。文法と語彙を強化したいです。',
--   desired_teacher_type = '文法の説明が上手で、試験対策の経験がある先生を希望します。',
--   japanese_level = 'intermediate',
--   availability = '週末の午後',
--   location = 'ノースヨーク'
-- WHERE user_id = 'USER_ID_HERE';

-- 生徒3のプロフィール更新例
-- UPDATE student_profiles
-- SET
--   bio = 'ビジネスで日本語を使う機会があるので、ビジネス日本語を学びたいです。',
--   learning_goals = 'ビジネスメールの書き方、敬語の使い方、プレゼンテーションを学びたいです。',
--   desired_teacher_type = 'ビジネス経験があり、実践的な日本語を教えてくれる先生を探しています。',
--   japanese_level = 'advanced',
--   availability = '平日のランチタイム、または夕方',
--   location = 'ミッドタウン'
-- WHERE user_id = 'USER_ID_HERE';

-- 先生プロフィールの更新例
-- UPDATE teacher_profiles
-- SET
--   bio = '日本で10年間、日本語教師として働いていました。初心者から上級者まで幅広く教えられます。',
--   teaching_experience = '日本語教師歴10年。JLPT対策、ビジネス日本語、日常会話など幅広く対応可能です。',
--   specialties = ARRAY['初級日本語', '日常会話', 'JLPT対策'],
--   location = 'トロントダウンタウン'
-- WHERE user_id = 'USER_ID_HERE';
