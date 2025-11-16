-- サンプルプロフィールデータ投入SQL
--
-- 使い方:
-- 1. UIから先生と生徒のアカウントを作成
-- 2. このSQLを実行すると、最新のユーザーのプロフィールが充実します
--
-- または、下記のクエリで特定のユーザーIDを確認してから更新してください:
-- SELECT id, email, role, full_name FROM profiles ORDER BY created_at DESC;

-- 最新の生徒3人のプロフィールを更新
WITH latest_students AS (
  SELECT p.id, p.email,
    ROW_NUMBER() OVER (ORDER BY p.created_at DESC) as rn
  FROM profiles p
  WHERE p.role = 'student'
)
UPDATE student_profiles sp
SET
  bio = CASE ls.rn
    WHEN 1 THEN '初めまして！カナダに来て1年になります。日常会話を中心に学びたいです。よろしくお願いします。'
    WHEN 2 THEN '日本のアニメや漫画が大好きです。N3レベルを目指して勉強中です。アニメの会話表現も学びたいです！'
    WHEN 3 THEN 'ビジネスで日本語を使う機会があるので、ビジネス日本語を学びたいです。丁寧語や敬語をマスターしたいです。'
  END,
  learning_goals = CASE ls.rn
    WHEN 1 THEN 'カフェやレストランでの注文、買い物、友達との会話など、日常生活で使える日本語を学びたいです。また、簡単な自己紹介もできるようになりたいです。'
    WHEN 2 THEN 'JLPT N3合格を目指しています。文法と語彙を強化したいです。特に、複雑な文章の読解力を上げたいと思っています。'
    WHEN 3 THEN 'ビジネスメールの書き方、敬語の正しい使い方、プレゼンテーションでの日本語表現を学びたいです。クライアントとのコミュニケーションを円滑にしたいです。'
  END,
  desired_teacher_type = CASE ls.rn
    WHEN 1 THEN '優しくて、間違いを丁寧に訂正してくれる先生を探しています。ゆっくり話してくれると嬉しいです。'
    WHEN 2 THEN '文法の説明が上手で、試験対策の経験がある先生を希望します。たくさん練習問題を一緒に解きたいです。'
    WHEN 3 THEN 'ビジネス経験があり、実践的な日本語を教えてくれる先生を探しています。ロールプレイングなどを取り入れてほしいです。'
  END,
  japanese_level = CASE ls.rn
    WHEN 1 THEN 'beginner'
    WHEN 2 THEN 'intermediate'
    WHEN 3 THEN 'advanced'
  END,
  availability = CASE ls.rn
    WHEN 1 THEN '平日の夕方18:00以降、週末の午前中'
    WHEN 2 THEN '週末の午後、土曜日の午後が特に都合良いです'
    WHEN 3 THEN '平日のランチタイム12:00-13:00、または夕方18:30以降'
  END,
  location = CASE ls.rn
    WHEN 1 THEN 'トロントダウンタウン（Union駅周辺）'
    WHEN 2 THEN 'ノースヨーク（Finch駅周辺）'
    WHEN 3 THEN 'ミッドタウン（Eglinton駅周辺）'
  END,
  updated_at = NOW()
FROM latest_students ls
WHERE sp.user_id = ls.id AND ls.rn <= 3;

-- 最新の先生2人のプロフィールを更新
WITH latest_teachers AS (
  SELECT p.id, p.email,
    ROW_NUMBER() OVER (ORDER BY p.created_at DESC) as rn
  FROM profiles p
  WHERE p.role = 'teacher'
)
UPDATE teacher_profiles tp
SET
  bio = CASE lt.rn
    WHEN 1 THEN '日本で10年間、日本語教師として働いていました。初心者から上級者まで幅広く教えられます。楽しく、効率的に学べるレッスンを心がけています。'
    WHEN 2 THEN 'トロント在住5年目の日本語ネイティブスピーカーです。カジュアルな会話から、ビジネス日本語まで対応できます。一緒に楽しく学びましょう！'
  END,
  teaching_experience = CASE lt.rn
    WHEN 1 THEN '日本語教師歴10年。JLPT対策、ビジネス日本語、日常会話など幅広く対応可能です。日本の大学で留学生向けの日本語コースも担当していました。'
    WHEN 2 THEN '日本語教育経験3年。主に日常会話とアニメ・マンガで使われる日本語を教えています。楽しく、リラックスした雰囲気でレッスンします。'
  END,
  specialties = CASE lt.rn
    WHEN 1 THEN ARRAY['初級日本語', '中級日本語', '上級日本語', 'JLPT対策', 'ビジネス日本語', '文法']
    WHEN 2 THEN ARRAY['日常会話', 'カジュアル日本語', 'アニメ・マンガ日本語', '発音練習', '初級日本語']
  END,
  location = CASE lt.rn
    WHEN 1 THEN 'トロントダウンタウン（どこでも対応可能）'
    WHEN 2 THEN 'ダウンタウン・ミッドタウン'
  END,
  updated_at = NOW()
FROM latest_teachers lt
WHERE tp.user_id = lt.id AND lt.rn <= 2;

-- 確認クエリ（実行後に確認用）
SELECT
  p.email,
  p.role,
  p.full_name,
  CASE
    WHEN p.role = 'student' THEN sp.bio
    WHEN p.role = 'teacher' THEN tp.bio
  END as bio,
  CASE
    WHEN p.role = 'student' THEN sp.japanese_level
    ELSE NULL
  END as level
FROM profiles p
LEFT JOIN student_profiles sp ON p.id = sp.user_id
LEFT JOIN teacher_profiles tp ON p.id = tp.user_id
ORDER BY p.created_at DESC
LIMIT 10;
