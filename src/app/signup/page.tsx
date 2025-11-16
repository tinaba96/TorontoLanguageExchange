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
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // ユーザー登録
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) {
        console.error('Auth error:', authError)
        throw new Error(`認証エラー: ${authError.message}`)
      }
      if (!authData.user) {
        throw new Error('ユーザー作成に失敗しました')
      }

      console.log('User created:', authData.user.id)

      // 少し待ってからプロフィール作成（認証情報が反映されるまで）
      await new Promise(resolve => setTimeout(resolve, 500))

      // プロフィール作成
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email,
          full_name: fullName,
          role,
        })

      if (profileError) {
        console.error('Profile error:', profileError)
        throw new Error(`プロフィール作成エラー: ${profileError.message}`)
      }

      console.log('Profile created')

      // ロール別のプロフィールテーブルにレコード作成
      if (role === 'student') {
        const { error: studentError } = await supabase
          .from('student_profiles')
          .insert({
            user_id: authData.user.id,
          })
        if (studentError) {
          console.error('Student profile error:', studentError)
          throw new Error(`生徒プロフィール作成エラー: ${studentError.message}`)
        }
        console.log('Student profile created')
      } else {
        const { error: teacherError } = await supabase
          .from('teacher_profiles')
          .insert({
            user_id: authData.user.id,
          })
        if (teacherError) {
          console.error('Teacher profile error:', teacherError)
          throw new Error(`先生プロフィール作成エラー: ${teacherError.message}`)
        }
        console.log('Teacher profile created')
      }

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
              <option value="student">生徒として登録</option>
              <option value="teacher">先生として登録</option>
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
