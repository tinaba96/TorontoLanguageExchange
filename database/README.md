# Database Documentation

このディレクトリには、Toronto Language Exchangeプロジェクトのデータベーススキーマとバックアップが含まれています。

## ファイル一覧

- `schema.sql` - 完全なデータベーススキーマ（テーブル、トリガー、ポリシー）
- `bulletin_board.sql` - 掲示板機能のスキーマ（投稿、コメント、いいね）
- `README.md` - このファイル

## リストア方法

### 新しいSupabaseプロジェクトにデータベースを復元する場合

1. [Supabaseダッシュボード](https://app.supabase.com)で新しいプロジェクトを作成

2. **SQL Editor** → **New query** を開く

3. `schema.sql` の内容をコピー＆ペースト

4. **Run** をクリック

5. 確認：
   ```sql
   -- テーブルが作成されたか確認
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public';

   -- トリガーが作成されたか確認
   SELECT trigger_name
   FROM information_schema.triggers
   WHERE trigger_name = 'on_auth_user_created';

   -- RLSポリシーが作成されたか確認
   SELECT tablename, policyname
   FROM pg_policies;
   ```

### 既存のデータベースをリセットして復元する場合

⚠️ **警告：すべてのデータが削除されます**

1. データを削除：
   ```sql
   -- すべてのデータを削除（構造は残る）
   TRUNCATE TABLE public.post_likes CASCADE;
   TRUNCATE TABLE public.comments CASCADE;
   TRUNCATE TABLE public.posts CASCADE;
   TRUNCATE TABLE public.messages CASCADE;
   TRUNCATE TABLE public.matches CASCADE;
   TRUNCATE TABLE public.teacher_profiles CASCADE;
   TRUNCATE TABLE public.student_profiles CASCADE;
   TRUNCATE TABLE public.profiles CASCADE;
   DELETE FROM auth.users;
   ```

2. テーブルを削除（完全リセット）：
   ```sql
   -- すべてを削除
   DROP TABLE IF EXISTS public.post_likes CASCADE;
   DROP TABLE IF EXISTS public.comments CASCADE;
   DROP TABLE IF EXISTS public.posts CASCADE;
   DROP TABLE IF EXISTS public.messages CASCADE;
   DROP TABLE IF EXISTS public.matches CASCADE;
   DROP TABLE IF EXISTS public.teacher_profiles CASCADE;
   DROP TABLE IF EXISTS public.student_profiles CASCADE;
   DROP TABLE IF EXISTS public.profiles CASCADE;
   DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
   ```

3. `schema.sql` を実行

## データベース構造

### テーブル

#### profiles
- ユーザーの基本情報
- role: 'teacher' または 'student'

#### student_profiles
- 生徒の詳細プロフィール
- 学習目標、日本語レベルなど

#### teacher_profiles
- 先生の詳細プロフィール
- 指導経験、専門分野など

#### matches
- 先生と生徒のマッチング情報

#### messages
- マッチング間のメッセージ

#### posts
- 掲示板への投稿
- タイトル、内容、投稿者情報

#### comments
- 投稿へのコメント
- コメント内容、投稿者情報

#### post_likes
- 投稿へのいいね
- ユーザーごとに1投稿1いいねまで（UNIQUE制約）

### トリガー

#### on_auth_user_created
- ユーザー作成時に自動的にプロフィールを作成
- user_metadataからroleとfull_nameを取得

### セキュリティ

- すべてのテーブルでRLS（Row Level Security）が有効
- ユーザーは自分のデータのみ変更可能
- プロフィールは全員が閲覧可能

## バックアップの更新

スキーマを変更した場合は、`schema.sql` を更新してください：

```sql
-- 現在のスキーマをエクスポート（参考）
-- Supabase CLIがインストールされている場合
supabase db dump -f database/schema.sql
```

または、手動で`schema.sql`を編集してください。

## トラブルシューティング

### トリガーが動作しない

```sql
-- トリガーの存在確認
SELECT * FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- トリガーを再作成
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### RLSポリシーのエラー

```sql
-- ポリシーの確認
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- RLSを一時的に無効化（開発時のみ）
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

### Realtime が動作しない

```sql
-- Realtimeの設定を確認
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- messagesテーブルを追加
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

## 環境変数

Vercelで以下の環境変数を設定してください：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app (本番のみ)
```

## よく使うクエリ集

### データの確認

```sql
-- すべてのテーブル一覧
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ユーザー数を確認
SELECT
  role,
  COUNT(*) as user_count
FROM profiles
GROUP BY role;

-- 投稿数、コメント数、いいね数を確認
SELECT
  (SELECT COUNT(*) FROM posts) as posts_count,
  (SELECT COUNT(*) FROM comments) as comments_count,
  (SELECT COUNT(*) FROM post_likes) as likes_count,
  (SELECT COUNT(*) FROM matches) as matches_count,
  (SELECT COUNT(*) FROM messages) as messages_count;

-- 最新の投稿を確認
SELECT
  p.title,
  p.content,
  pr.full_name as author_name,
  p.created_at,
  (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
  (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
FROM posts p
JOIN profiles pr ON p.user_id = pr.id
ORDER BY p.created_at DESC
LIMIT 10;

-- 人気の投稿（いいね数順）
SELECT
  p.title,
  pr.full_name as author_name,
  COUNT(pl.id) as likes_count
FROM posts p
JOIN profiles pr ON p.user_id = pr.id
LEFT JOIN post_likes pl ON p.id = pl.post_id
GROUP BY p.id, p.title, pr.full_name
ORDER BY likes_count DESC
LIMIT 10;

-- ユーザーのプロフィール詳細を確認
SELECT
  p.email,
  p.full_name,
  p.role,
  p.created_at,
  CASE
    WHEN p.role = 'student' THEN sp.japanese_level
    ELSE NULL
  END as japanese_level,
  CASE
    WHEN p.role = 'student' THEN sp.bio
    WHEN p.role = 'teacher' THEN tp.bio
  END as bio
FROM profiles p
LEFT JOIN student_profiles sp ON p.id = sp.user_id
LEFT JOIN teacher_profiles tp ON p.id = tp.user_id
ORDER BY p.created_at DESC;
```

### データのクリーンアップ

```sql
-- 特定のユーザーを削除（CASCADE で関連データも削除される）
DELETE FROM auth.users WHERE email = 'example@email.com';

-- 古い投稿を削除（30日以上前）
DELETE FROM posts
WHERE created_at < NOW() - INTERVAL '30 days';

-- いいねのない投稿を削除
DELETE FROM posts
WHERE id NOT IN (SELECT DISTINCT post_id FROM post_likes);

-- 特定の投稿とその関連データを削除
DELETE FROM posts WHERE id = 'post-uuid-here';
-- CASCADE により、comments と post_likes も自動削除される
```

### デバッグ用

```sql
-- RLSポリシーの確認
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- トリガーの確認
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- Realtime Publicationの確認
SELECT
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- インデックスの確認
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### パフォーマンス分析

```sql
-- テーブルのサイズを確認
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 各ユーザーの投稿数とコメント数
SELECT
  p.full_name,
  p.email,
  COUNT(DISTINCT posts.id) as posts_count,
  COUNT(DISTINCT comments.id) as comments_count
FROM profiles p
LEFT JOIN posts ON p.id = posts.user_id
LEFT JOIN comments ON p.id = comments.user_id
GROUP BY p.id, p.full_name, p.email
ORDER BY posts_count DESC, comments_count DESC;
```

## 掲示板機能の追加方法

既存のプロジェクトに掲示板機能を追加する場合：

1. **SQL Editorで実行**
   ```sql
   -- bulletin_board.sql の内容を実行
   ```

2. **確認**
   ```sql
   -- 新しいテーブルが作成されたか確認
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('posts', 'comments', 'post_likes');
   ```

3. **Realtimeが有効か確認**
   ```sql
   SELECT tablename
   FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime'
   AND tablename IN ('posts', 'comments', 'post_likes');
   ```

## リンク

- [Supabaseダッシュボード](https://app.supabase.com/project/hamsshxskkwxecmvndcw)
- [Vercelダッシュボード](https://vercel.com/dashboard)
