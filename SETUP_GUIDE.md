# セットアップガイド

このガイドでは、Toronto Language Exchangeアプリケーションをローカル環境で動作させるまでの手順を説明します。

## 必要なもの

- Node.js 18以上
- npmまたはyarn
- Supabaseアカウント（無料）
- GitHubアカウント（デプロイする場合）

## ステップ1: リポジトリのクローン

```bash
git clone <your-repository-url>
cd TorontoLanguageExchange
```

## ステップ2: 依存関係のインストール

```bash
npm install
```

## ステップ3: Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com)にアクセス
2. 「New Project」をクリック
3. プロジェクト名を入力（例: toronto-language-exchange）
4. データベースパスワードを設定（安全なパスワードを使用）
5. リージョンを選択（日本の場合は「Northeast Asia (Tokyo)」推奨）
6. 「Create new project」をクリック

プロジェクトの作成には1〜2分かかります。

## ステップ4: Supabaseの認証情報を取得

1. Supabaseダッシュボードで作成したプロジェクトを開く
2. 左側のメニューから「Settings」→「API」を選択
3. 以下の情報をコピー:
   - `Project URL`
   - `anon public` キー

## ステップ5: 環境変数の設定

プロジェクトのルートディレクトリに`.env.local`ファイルを作成:

```bash
cp .env.local.example .env.local
```

`.env.local`ファイルを編集して、コピーした情報を貼り付け:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## ステップ6: データベースのセットアップ

### 方法A: Supabaseダッシュボードから（推奨）

1. Supabaseダッシュボードの左側メニューから「SQL Editor」を選択
2. 「New query」をクリック
3. `supabase/migrations/20240101000000_initial_schema.sql`ファイルの内容をコピーして貼り付け
4. 「Run」をクリックして実行

### 方法B: Supabase CLIを使用

```bash
# Supabase CLIのインストール
npm install -g supabase

# Supabaseにログイン
supabase login

# プロジェクトにリンク（Project Refは Settings > General で確認）
supabase link --project-ref your-project-ref

# マイグレーションの実行
supabase db push
```

## ステップ7: 認証設定の確認

1. Supabaseダッシュボードで「Authentication」→「Settings」を選択
2. 「Email Auth」が有効になっていることを確認
3. 「Confirm email」をオフにする（開発環境の場合）
   - 本番環境では必ずオンにしてください

## ステップ8: 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開く

## テスト用アカウントの作成

1. トップページで「新規登録」をクリック
2. 先生または生徒として登録
3. ログイン

複数のアカウントを作成して、マッチング機能をテストすることをお勧めします。

## トラブルシューティング

### エラー: "Invalid API key"

- `.env.local`ファイルが正しく設定されているか確認
- 環境変数名が`NEXT_PUBLIC_`で始まっているか確認
- 開発サーバーを再起動

### エラー: "relation does not exist"

- データベースマイグレーションが実行されているか確認
- Supabase SQL Editorでテーブルが作成されているか確認

### ログイン後、ページが表示されない

- ブラウザのコンソールでエラーを確認
- RLSポリシーが正しく設定されているか確認

### リアルタイムメッセージが更新されない

1. Supabaseダッシュボードで「Database」→「Replication」を選択
2. `messages`テーブルのReplicationを有効化

## 本番環境へのデプロイ

### Vercelへのデプロイ

1. [Vercel](https://vercel.com)にサインアップ
2. GitHubリポジトリをインポート
3. 環境変数を設定:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. 「Deploy」をクリック

### 本番環境の設定

1. Supabaseダッシュボードで「Authentication」→「URL Configuration」を選択
2. Site URLにVercelのデプロイURLを追加
3. Redirect URLsにも追加（例: `https://your-app.vercel.app/auth/callback`）

## セキュリティ上の注意

- `.env.local`ファイルは絶対にGitにコミットしない
- 本番環境では必ずメール確認を有効化
- データベースパスワードは安全に管理
- 定期的にSupabaseのセキュリティアップデートを確認

## 次のステップ

- プロフィール画像アップロード機能の追加
- 検索・フィルタリング機能の実装
- 通知機能の追加
- レビュー・評価システムの構築

詳細は`SYSTEM_DESIGN.md`を参照してください。
