'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // メール認証設定を確認
      const { data: emailVerificationSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'email_verification_required')
        .single()

      const emailVerificationRequired = emailVerificationSetting?.value === 'true'

      // メール認証が必要で、まだ認証されていない場合
      if (emailVerificationRequired && !data.user.email_confirmed_at) {
        await supabase.auth.signOut()
        throw new Error('メール認証が完了していません。登録時に送信された確認メールのリンクをクリックしてください。')
      }

      // ユーザーのロールを取得
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      // ログイン後は全体告知ページへリダイレクト
      router.push('/announcements')
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0B1629' }}>
      {/* ── Left: Form Panel ── */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 relative z-10">
        {/* Back link */}
        <Link
          href="/"
          className="absolute top-8 left-8 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          トップに戻る
        </Link>

        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <div className="mb-10">
            <Link href="/">
              <span
                className="text-3xl font-extrabold"
                style={{ fontFamily: 'var(--font-syne)', background: 'linear-gradient(135deg, #818CF8, #6366F1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                LTOC
              </span>
            </Link>
            <p className="text-slate-500 text-xs mt-1 tracking-widest uppercase">Language & Toronto Community</p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1
              className="text-4xl font-extrabold text-white mb-2"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              おかえりなさい
            </h1>
            <p className="text-slate-400">アカウントにサインインしてください</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl text-sm text-red-300"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 rounded-xl text-white placeholder-slate-500 text-sm transition-all outline-none"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,102,241,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
                placeholder="example@email.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                パスワード
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 pr-12 rounded-xl text-white placeholder-slate-500 text-sm transition-all outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,102,241,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                  onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 mt-2"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', boxShadow: '0 0 30px rgba(79,70,229,0.3)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ログイン中...
                </span>
              ) : 'ログイン'}
            </button>
          </form>

          {/* Sign up link */}
          <p className="mt-8 text-center text-sm text-slate-500">
            アカウントをお持ちでない方は{' '}
            <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
              新規登録
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right: Photo Panel ── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1543269664-56d93c1b41a6?w=1200&auto=format&fit=crop&q=80"
          alt="Language exchange cafe"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(11,22,41,0.5) 0%, rgba(11,22,41,0.2) 100%)' }} />

        {/* Floating quote card */}
        <div className="absolute bottom-12 left-10 right-10">
          <div className="glass rounded-2xl p-6">
            <p className="text-white font-medium leading-relaxed mb-3">
              「トロントで新しい友達ができて、英語も上手くなれた。LTOCのおかげです！」
            </p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&auto=format&fit=crop&q=80"
                  alt="member"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">Yuki</p>
                <p className="text-slate-300 text-xs">Student Member</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
