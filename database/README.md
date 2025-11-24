# Database Documentation

このディレクトリには、Toronto Language Exchangeプロジェクトのデータベーススキーマとバックアップが含まれています。

## ファイル一覧

- `schema.sql` - 完全なデータベーススキーマ（テーブル、トリガー、ポリシー）
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

## リンク

- [Supabaseダッシュボード](https://app.supabase.com/project/hamsshxskkwxecmvndcw)
- [Vercelダッシュボード](https://vercel.com/dashboard)
