# クイックスタートガイド

このガイドに従って、5分でアプリケーションを起動できます。

## ステップ1: データベースマイグレーションを実行

1. [Supabase SQL Editor](https://supabase.com/dashboard/project/hamsshxskkwxecmvndcw/sql/new)を開く
2. `supabase/migrations/20240101000000_initial_schema.sql`の全内容をコピー
3. SQL Editorに貼り付けて**Run**をクリック

成功すると、以下のテーブルが作成されます:
- profiles
- student_profiles
- teacher_profiles
- matches
- messages

## ステップ2: メール確認を無効化（開発用）

1. [Authentication Providers](https://supabase.com/dashboard/project/hamsshxskkwxecmvndcw/auth/providers)を開く
2. **Email**をクリック
3. **Confirm email**のトグルをオフにする
4. **Save**をクリック

## ステップ3: 開発サーバーを起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開く

## ステップ4: テストユーザーを作成

### 生徒アカウントを3つ作成

1. http://localhost:3000/signup にアクセス
2. 以下の情報で登録:

**生徒1**
- 登録タイプ: 生徒として登録
- 氏名: 田中花子
- メール: student1@example.com
- パスワード: password123

**生徒2**
- 登録タイプ: 生徒として登録
- 氏名: 佐藤太郎
- メール: student2@example.com
- パスワード: password123

**生徒3**
- 登録タイプ: 生徒として登録
- 氏名: 鈴木次郎
- メール: student3@example.com
- パスワード: password123

### 先生アカウントを2つ作成

**先生1**
- 登録タイプ: 先生として登録
- 氏名: 山田先生
- メール: teacher1@example.com
- パスワード: password123

**先生2**
- 登録タイプ: 先生として登録
- 氏名: 小林先生
- メール: teacher2@example.com
- パスワード: password123

## ステップ5: サンプルデータを投入

1. [Supabase SQL Editor](https://supabase.com/dashboard/project/hamsshxskkwxecmvndcw/sql/new)を開く
2. `supabase/seed_sample_profiles.sql`の全内容をコピー
3. SQL Editorに貼り付けて**Run**をクリック

これで、生徒と先生のプロフィールが充実します。

## ステップ6: 動作確認

### 先生としてログイン

1. ログアウト（右上のボタン）
2. teacher1@example.com でログイン
3. 生徒一覧が表示される
4. 好きな生徒の「この生徒を教える」ボタンをクリック
5. メッセージページに移動

### メッセージを送る

1. メッセージを入力して送信
2. リアルタイムで表示されることを確認

### 生徒としてログイン

1. 別のブラウザ（またはシークレットモード）で http://localhost:3000 を開く
2. student1@example.com でログイン
3. 右上の「メッセージ」ボタンをクリック（先生からマッチングされている場合）
4. 先生からのメッセージを確認
5. 返信を送る

## トラブルシューティング

### エラー: "failed to fetch"

**原因1**: データベースマイグレーションが実行されていない
- ステップ1を確認

**原因2**: メール確認が有効になっている
- ステップ2を確認

**原因3**: 環境変数が設定されていない
- `.env.local`ファイルが存在するか確認
- 開発サーバーを再起動

### エラー: "relation does not exist"

- Supabaseでテーブルが作成されているか確認
- Database → Tables で確認

### ブラウザのコンソールエラーを確認

1. ブラウザで F12 を押す
2. Console タブを開く
3. エラーメッセージを確認

詳細なエラーメッセージが表示されるようになっているので、問題の特定が簡単です。

## 次のステップ

- 生徒のプロフィールを編集してみる
- 複数のマッチングを作成してみる
- メッセージ機能をテストする
- デザインをカスタマイズする

## 本番環境へのデプロイ

詳細は `DEPLOYMENT_CHECKLIST.md` を参照してください。
