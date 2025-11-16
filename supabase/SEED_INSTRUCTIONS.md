# Sample Data Setup Instructions

このガイドでは、テスト用のサンプルデータをデータベースに投入する手順を説明します。

## ステップ1: テストユーザーを作成

まず、Supabaseダッシュボードまたはアプリケーションのサインアップページで以下のユーザーを作成します：

### オプション A: アプリケーションのサインアップページを使用（推奨）

1. ローカルで開発サーバーを起動: `npm run dev`
2. `http://localhost:3000/signup` にアクセス
3. 以下のアカウントを作成:
   - **Student1**: `student1@example.com` / `password123` (生徒として登録)
   - **Teacher1**: `teacher1@example.com` / `password123` (先生として登録)
   - **Teacher2**: `teacher2@example.com` / `password123` (先生として登録)

### オプション B: Supabase Dashboardを使用

1. [Supabase Dashboard](https://app.supabase.com) にログイン
2. プロジェクトを選択
3. Authentication > Users に移動
4. "Add user" ボタンをクリック
5. 各ユーザーのメールアドレスとパスワードを入力して作成

## ステップ2: ユーザーIDを取得

1. Supabase Dashboard > Authentication > Users に移動
2. 作成した各ユーザーのUUID（ID）をコピー

## ステップ3: seed.sqlファイルを編集

1. `supabase/seed.sql` ファイルを開く
2. 以下の行のUUIDを実際のユーザーIDに置き換え:

```sql
  student1_id UUID := '00000000-0000-0000-0000-000000000001'; -- ← student1@example.comの実際のUUIDに置き換え
  teacher1_id UUID := '00000000-0000-0000-0000-000000000002'; -- ← teacher1@example.comの実際のUUIDに置き換え
  teacher2_id UUID := '00000000-0000-0000-0000-000000000003'; -- ← teacher2@example.comの実際のUUIDに置き換え
```

## ステップ4: SQLスクリプトを実行

### オプション A: Supabase Dashboard SQL Editorを使用

1. Supabase Dashboard > SQL Editor に移動
2. "New query" をクリック
3. `seed.sql` の内容をコピー＆ペースト
4. "Run" ボタンをクリック

### オプション B: Supabase CLIを使用

```bash
# Supabaseプロジェクトにログイン
supabase login

# プロジェクトをリンク（初回のみ）
supabase link --project-ref your-project-ref

# シードスクリプトを実行
supabase db execute -f supabase/seed.sql
```

## ステップ5: データの確認

1. Supabase Dashboard > Table Editor に移動
2. 以下のテーブルにデータが投入されていることを確認:
   - `profiles`: 3レコード（student1, teacher1, teacher2）
   - `student_profiles`: 1レコード（student1）
   - `teacher_profiles`: 2レコード（teacher1, teacher2）
   - `matches`: 2レコード（student1とteacher1、student1とteacher2）
   - `messages`: 8レコード（各マッチの会話履歴）

## ステップ6: アプリケーションで確認

1. `student1@example.com` でログイン
2. ダッシュボードでマッチングとメッセージが表示されることを確認

## トラブルシューティング

### エラー: "foreign key constraint"

ユーザーIDが正しく設定されていない可能性があります。`seed.sql`のUUIDを再確認してください。

### エラー: "permission denied"

RLSポリシーが正しく設定されていない可能性があります。`supabase/migrations/20240101000000_initial_schema.sql`のマイグレーションが実行されていることを確認してください。

### データが表示されない

1. ブラウザのコンソールでエラーを確認
2. `.env.local`の環境変数が正しく設定されているか確認
3. ログアウトして再ログインを試す

## サンプルデータの内容

- **Student1 (田中 太郎)**: 中級レベルの日本語学習者、JLPT N3を目指している
- **Teacher1 (佐藤 花子)**: 5年の指導経験を持つ日本語教師
- **Teacher2 (John Smith)**: 3年の指導経験、ビジネス日本語が専門
- **Match1**: Student1 ⟷ Teacher1（7日前にマッチング、5つのメッセージ）
- **Match2**: Student1 ⟷ Teacher2（3日前にマッチング、3つのメッセージ）
