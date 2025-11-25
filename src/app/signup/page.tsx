'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'teacher' | 'student'>('student')
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 合言葉の検証
      const { data: settingsData, error: settingsError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'registration_passphrase')
        .single()

      if (settingsError) {
        console.error('Settings error:', settingsError)
        throw new Error('システムエラーが発生しました')
      }

      if (passphrase !== settingsData?.value) {
        throw new Error('合言葉が正しくありません')
      }

      // デバッグ: Supabaseクライアントの確認
      console.log('Supabase client created:', !!supabase)
      console.log('Email:', email)
      console.log('Password length:', password.length)
      console.log('Selected role:', role)

      // ユーザー登録
      // Vercelの自動環境変数を優先的に使用
      const getRedirectUrl = () => {
        // 1. 明示的に設定されたSITE_URLを使用
        if (process.env.NEXT_PUBLIC_SITE_URL) {
          return `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
        }

        // 2. Vercelの自動提供URL（https://付き）
        if (process.env.NEXT_PUBLIC_VERCEL_URL) {
          return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/auth/callback`
        }

        // 3. フォールバック：現在のオリジン（開発環境）
        return `${window.location.origin}/auth/callback`
      }

      const redirectUrl = getRedirectUrl()

      console.log('=== Signup Debug ===')
      console.log('NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL)
      console.log('NEXT_PUBLIC_VERCEL_URL:', process.env.NEXT_PUBLIC_VERCEL_URL)
      console.log('window.location.origin:', window.location.origin)
      console.log('Final Redirect URL:', redirectUrl)
      console.log('==================')

      console.log('📝 Signup data:', {
        email,
        full_name: fullName,
        role: role,
      })

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            role: role,
          },
        },
      })

      if (authError) {
        console.error('Auth error:', authError)
        throw new Error(`認証エラー: ${authError.message}`)
      }
      if (!authData.user) {
        throw new Error('ユーザー作成に失敗しました')
      }

      console.log('=== CODE VERSION: 2024-11-24-v3 - TRIGGER ONLY ===')
      console.log('User created:', authData.user.id)
      console.log('Profile will be created automatically by database trigger')
      console.log('=== NO CLIENT-SIDE PROFILE CREATION ===')
      console.log('Timestamp:', new Date().toISOString())

      // メール確認が必要な場合
      if (authData.user && !authData.session) {
        alert('登録完了！メールに送信された確認リンクをクリックしてください。')
        router.push('/login')
        return
      }

      // メール確認不要の場合（即座にログイン）
      // 少し待ってからリダイレクト（トリガーが完了するまで）
      await new Promise(resolve => setTimeout(resolve, 1000))

      // ロールに応じてリダイレクト
      if (role === 'teacher') {
        router.push('/teacher')
      } else {
        router.push('/student')
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || '登録に失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          新規登録
        </h1>

        <form onSubmit={handleSignUp} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              登録タイプ
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'teacher' | 'student')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="student">English Speaker (日本語を学びたい)</option>
              <option value="teacher">Japanese (英語を学びたい)</option>
            </select>
          </div>

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              氏名
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="山田 太郎"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              パスワード（6文字以上）
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="passphrase" className="block text-sm font-medium text-gray-700 mb-2">
              合言葉
            </label>
            <input
              id="passphrase"
              type="text"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="運営から共有された合言葉を入力"
            />
            <p className="mt-1 text-sm text-gray-500">
              登録には合言葉が必要です
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登録中...' : '登録する'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600">
          すでにアカウントをお持ちの方は{' '}
          <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}
