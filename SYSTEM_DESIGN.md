# Toronto Language Exchange - システム設計書

## 概要
日本語の先生と生徒をマッチングするウェブアプリケーション

## 技術スタック
- **フロントエンド**: Next.js 14 (App Router)
- **バックエンド**: Supabase (PostgreSQL, Auth, Realtime)
- **スタイリング**: Tailwind CSS + shadcn/ui
- **言語**: TypeScript
- **デプロイ**: Vercel

## データベース設計

### テーブル構成

#### 1. profiles
ユーザーの基本情報とロール管理
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. student_profiles
生徒専用のプロフィール情報
```sql
CREATE TABLE student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bio TEXT,
  learning_goals TEXT,
  desired_teacher_type TEXT,
  japanese_level TEXT CHECK (japanese_level IN ('beginner', 'intermediate', 'advanced')),
  availability TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);
```

#### 3. teacher_profiles
先生専用のプロフィール情報
```sql
CREATE TABLE teacher_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bio TEXT,
  teaching_experience TEXT,
  specialties TEXT[],
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);
```

#### 4. matches
先生と生徒のマッチング管理
```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teacher_id, student_id)
);
```

#### 5. messages
DM機能のメッセージ管理
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_match_id ON messages(match_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

## Row Level Security (RLS) ポリシー

### profiles
```sql
-- ユーザーは自分のプロフィールのみ更新可能
-- 全ユーザーは他のユーザーのプロフィールを閲覧可能
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

### student_profiles
```sql
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view student profiles"
  ON student_profiles FOR SELECT
  USING (true);

CREATE POLICY "Students can update own profile"
  ON student_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Students can insert own profile"
  ON student_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### teacher_profiles
```sql
ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view teacher profiles"
  ON teacher_profiles FOR SELECT
  USING (true);

CREATE POLICY "Teachers can update own profile"
  ON teacher_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Teachers can insert own profile"
  ON teacher_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### matches
```sql
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own matches"
  ON matches FOR SELECT
  USING (auth.uid() = teacher_id OR auth.uid() = student_id);

CREATE POLICY "Teachers can create matches"
  ON matches FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Match participants can update matches"
  ON matches FOR UPDATE
  USING (auth.uid() = teacher_id OR auth.uid() = student_id);
```

### messages
```sql
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their matches"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
      AND (matches.teacher_id = auth.uid() OR matches.student_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their matches"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
      AND (matches.teacher_id = auth.uid() OR matches.student_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (auth.uid() = sender_id);
```

## アプリケーション構成

### ディレクトリ構造
```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/              # 認証関連のルート
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/         # ダッシュボード（認証必須）
│   │   ├── student/         # 生徒用ページ
│   │   ├── teacher/         # 先生用ページ
│   │   └── messages/        # メッセージページ
│   ├── api/                 # API Routes
│   └── layout.tsx
├── components/
│   ├── ui/                  # shadcn/ui コンポーネント
│   ├── auth/                # 認証関連コンポーネント
│   ├── profile/             # プロフィール関連
│   ├── messages/            # メッセージ関連
│   └── layout/              # レイアウト関連
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # クライアントサイド
│   │   ├── server.ts        # サーバーサイド
│   │   └── middleware.ts    # ミドルウェア
│   ├── hooks/               # カスタムフック
│   ├── utils/               # ユーティリティ関数
│   └── types/               # 型定義
└── middleware.ts             # Next.js ミドルウェア
```

### 主要機能フロー

#### 1. ユーザー登録・ログイン
1. Supabase Authを使用したメール/パスワード認証
2. サインアップ時にロール（teacher/student）を選択
3. プロフィール作成ページへリダイレクト

#### 2. プロフィール作成・編集
- **生徒**: 学習目標、求める先生像、日本語レベルなど
- **先生**: 教育経験、専門分野など

#### 3. マッチングフロー
1. 先生がダッシュボードで生徒一覧を閲覧
2. 生徒のプロフィールを確認
3. 「この生徒を教えたい」ボタンをクリック
4. マッチングレコードが作成され、DMが開始可能に

#### 4. メッセージング
1. マッチング後、メッセージページで会話
2. Supabase Realtimeを使用したリアルタイム更新
3. 未読管理機能

## セキュリティ考慮事項

1. **Row Level Security (RLS)**: すべてのテーブルでRLSを有効化
2. **認証**: Supabase Authによる安全な認証
3. **XSS対策**: Reactの自動エスケープ機能
4. **CSRF対策**: Next.jsのビルトイン保護
5. **環境変数**: Supabaseキーは環境変数で管理

## パフォーマンス最適化

1. **データベースインデックス**: 頻繁にクエリされるカラムにインデックス
2. **画像最適化**: Next.js Image コンポーネント使用
3. **コード分割**: 動的インポートとルートベースの分割
4. **キャッシング**: Next.jsのビルトインキャッシュ機能

## スケーラビリティ

1. **データベース**: Supabaseの自動スケーリング
2. **サーバーレス**: Vercelのエッジファンクション
3. **CDN**: Vercelのグローバルエッジネットワーク

## 今後の拡張性

1. 評価・レビュー機能
2. スケジュール管理機能
3. ビデオ通話統合（オプション）
4. 通知機能（メール・プッシュ通知）
5. 検索・フィルタリング機能の強化
6. 多言語対応
