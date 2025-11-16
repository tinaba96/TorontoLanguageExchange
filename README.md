# Toronto Language Exchange

日本語の先生と生徒をマッチングするウェブアプリケーション

## 特徴

- **先生と生徒のマッチング**: 先生が生徒のプロフィールを閲覧し、教えたい生徒を選択
- **プロフィール管理**: 生徒は学習目標や理想の先生像を記載
- **リアルタイムメッセージング**: マッチング後、DM機能で対面授業の詳細を調整
- **シンプルなUI**: 直感的で使いやすいデザイン
- **セキュア**: Row Level Securityによるデータ保護

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **バックエンド**: Supabase (PostgreSQL, Auth, Realtime)
- **デプロイ**: Vercel

## セットアップ

### 前提条件

- Node.js 18以上
- Supabaseアカウント

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd TorontoLanguageExchange
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com)にアクセスし、新しいプロジェクトを作成
2. プロジェクトのURLとANON KEYを取得

### 4. 環境変数の設定

`.env.local`ファイルを作成:

```bash
cp .env.local.example .env.local
```

`.env.local`を編集して、Supabaseの認証情報を設定:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. データベースのセットアップ

Supabaseダッシュボードの「SQL Editor」で、以下のSQLファイルを実行:

```
supabase/migrations/20240101000000_initial_schema.sql
```

または、Supabase CLIを使用:

```bash
# Supabase CLIのインストール（初回のみ）
npm install -g supabase

# Supabaseにログイン
supabase login

# プロジェクトにリンク
supabase link --project-ref your-project-ref

# マイグレーションの実行
supabase db push
```

### 6. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開く

## ディレクトリ構成

```
src/
├── app/                      # Next.js App Router
│   ├── (dashboard)/         # 認証必須ルート
│   │   ├── student/         # 生徒用ページ
│   │   ├── teacher/         # 先生用ページ
│   │   └── messages/        # メッセージページ
│   ├── login/               # ログインページ
│   ├── signup/              # サインアップページ
│   └── page.tsx             # トップページ
├── components/              # Reactコンポーネント
├── lib/
│   ├── supabase/           # Supabase設定
│   ├── types/              # 型定義
│   ├── hooks/              # カスタムフック
│   └── utils/              # ユーティリティ関数
└── middleware.ts            # Next.jsミドルウェア
```

## 主要機能

### ユーザー登録・ログイン

- メール/パスワードによる認証
- 登録時に先生/生徒のロールを選択

### プロフィール管理

**生徒**
- 自己紹介
- 学習目標
- 理想の先生像
- 日本語レベル（初級/中級/上級）
- 対応可能な時間帯
- 場所

**先生**
- 自己紹介
- 教育経験
- 専門分野
- 場所

### マッチング

1. 先生がダッシュボードで生徒一覧を閲覧
2. 生徒のプロフィールを確認
3. 「この生徒を教える」ボタンでマッチング
4. マッチング成立後、メッセージページでDM開始

### メッセージング

- リアルタイムメッセージング（Supabase Realtime）
- マッチング一覧
- 個別チャット

## デプロイ

### Vercelへのデプロイ

1. Vercelアカウントを作成
2. GitHubリポジトリと連携
3. 環境変数を設定（NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY）
4. デプロイ

```bash
# Vercel CLIを使用する場合
npm install -g vercel
vercel
```

## セキュリティ

- Row Level Security (RLS) による厳格なアクセス制御
- Supabase Authによる安全な認証
- 環境変数による機密情報の管理

## 今後の拡張案

- [ ] 評価・レビュー機能
- [ ] スケジュール管理
- [ ] 検索・フィルタリング機能
- [ ] 通知機能（メール・プッシュ通知）
- [ ] プロフィール画像アップロード
- [ ] 多言語対応

## ライセンス

MIT

## サポート

問題が発生した場合は、GitHubのIssuesで報告してください。
