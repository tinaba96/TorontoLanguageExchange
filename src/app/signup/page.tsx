'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Eye, EyeOff, ChevronDown, Mail, KeyRound, Info } from 'lucide-react'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      // 合言葉とバージョンの検証
      const [passphraseResult, versionResult, emailVerificationResult] = await Promise.all([
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'registration_passphrase')
          .single(),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'passphrase_version')
          .single(),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'email_verification_required')
          .single()
      ])

      const emailVerificationRequired = emailVerificationResult.data?.value === 'true'

      if (passphraseResult.error) {
        console.error('Settings error:', passphraseResult.error)
        throw new Error('システムエラーが発生しました')
      }

      if (passphrase !== passphraseResult.data?.value) {
        throw new Error('合言葉が正しくありません')
      }

      const currentVersion = parseInt(versionResult.data?.value || '1', 10)

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

      // メール認証が必要な設定の場合
      if (emailVerificationRequired && authData.user && !authData.session) {
        alert('登録完了！メールに送信された確認リンクをクリックしてください。')
        router.push('/login')
        return
      }

      // メール認証不要の場合、または即座にセッションが発行された場合
      // 少し待ってからリダイレクト（トリガーが完了するまで）
      await new Promise(resolve => setTimeout(resolve, 1000))

      // passphrase_versionを更新
      await supabase
        .from('profiles')
        .update({ passphrase_version: currentVersion })
        .eq('id', authData.user.id)

      // メール認証不要の設定で、セッションがない場合は自動ログイン
      if (!emailVerificationRequired && !authData.session) {
        // セッションがない場合でも、認証不要設定ならログインページへ案内
        alert('登録完了！ログインしてください。')
        router.push('/login')
        return
      }

      // 全体告知ページへリダイレクト
      router.push('/announcements')
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || '登録に失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-4 py-3.5 rounded-xl text-white placeholder-slate-500 text-sm transition-all outline-none"
  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }
  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.currentTarget.style.border = '1px solid rgba(99,102,241,0.6)'
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'
      e.currentTarget.style.boxShadow = 'none'
    },
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0B1629' }}>
      {/* ── Left: Photo Panel ── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&auto=format&fit=crop&q=80"
          alt="Students studying together"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(11,22,41,0.3) 0%, rgba(11,22,41,0.15) 100%)' }} />

        {/* Stats overlay */}
        <div className="absolute top-1/2 -translate-y-1/2 left-10 right-10 space-y-4">
          {[
            { num: '200+', label: 'アクティブメンバー' },
            { num: '150+', label: '言語交換セッション' },
            { num: '50+', label: '毎月のイベント' },
          ].map((s, i) => (
            <div key={i} className="glass rounded-2xl px-6 py-4 flex items-center gap-4">
              <span className="text-3xl font-extrabold text-white" style={{ fontFamily: 'var(--font-syne)', color: '#FF6B6B' }}>{s.num}</span>
              <span className="text-white text-sm font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Form Panel ── */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-20 py-12 relative overflow-y-auto">
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
          <div className="mb-8">
            <Link href="/">
              <span
                className="text-3xl font-extrabold"
                style={{ fontFamily: 'var(--font-syne)', background: 'linear-gradient(135deg, #818CF8, #6366F1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                LTOC
              </span>
            </Link>
            <p className="text-slate-500 text-xs mt-1 tracking-widest uppercase">Toronto Language Community</p>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h1
              className="text-4xl font-extrabold text-white mb-2"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              コミュニティに参加
            </h1>
            <p className="text-slate-400">アカウントを作成してトロントで繋がろう</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm text-red-300"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Role toggle */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">登録タイプ</label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                  { value: 'student', label: 'English Speaker', sub: '日本語を学びたい' },
                  { value: 'teacher', label: 'Japanese', sub: '英語を学びたい' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value as 'student' | 'teacher')}
                    className="flex flex-col items-center gap-0.5 py-3 px-2 rounded-lg text-sm font-semibold transition-all"
                    style={role === opt.value ? {
                      background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
                      color: 'white',
                    } : {
                      color: '#94A3B8',
                    }}
                  >
                    <span>{opt.label}</span>
                    <span className="text-xs font-normal opacity-70">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Full name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-300 mb-2">氏名</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={inputClass}
                style={inputStyle}
                {...focusHandlers}
                placeholder="山田 太郎"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">メールアドレス</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                style={inputStyle}
                {...focusHandlers}
                placeholder="example@email.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">パスワード（6文字以上）</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className={`${inputClass} pr-12`}
                  style={inputStyle}
                  {...focusHandlers}
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

            {/* Passphrase */}
            <div>
              <label htmlFor="passphrase" className="flex items-center gap-1.5 text-sm font-medium text-slate-300 mb-2">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                合言葉
                <span className="text-xs font-normal text-slate-500">(招待制)</span>
              </label>
              <input
                id="passphrase"
                type="text"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                required
                className={inputClass}
                style={inputStyle}
                {...focusHandlers}
                placeholder="運営から共有された合言葉を入力"
              />

              {/* Contact-the-operator notice */}
              <div className="mt-3 rounded-xl p-3 flex items-start gap-2.5"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)' }}>
                <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <p className="font-medium mb-1">合言葉をお持ちでない方</p>
                  <p className="text-slate-400 mb-2">
                    LTOC は招待制コミュニティです。合言葉は運営または既存メンバーから取得してください。
                  </p>
                  <a
                    href="mailto:info@ltoc.ca?subject=LTOC%E3%81%AE%E5%90%88%E8%A8%80%E8%91%89%E3%81%AE%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B&body=LTOC%E3%81%AB%E5%8F%82%E5%8A%A0%E3%81%97%E3%81%9F%E3%81%84%E3%81%AE%E3%81%A7%E3%80%81%E5%90%88%E8%A8%80%E8%91%89%E3%82%92%E6%95%99%E3%81%88%E3%81%A6%E3%81%84%E3%81%9F%E3%81%A0%E3%81%91%E3%81%BE%E3%81%99%E3%81%8B%EF%BC%9F%0A%0A%E3%81%8A%E5%90%8D%E5%89%8D%EF%BC%9A%0A%E3%83%AD%E3%83%BC%E3%83%AB%EF%BC%88%E5%85%88%E7%94%9F%2F%E7%94%9F%E5%BE%92%EF%BC%89%EF%BC%9A%0A%E8%87%AA%E5%B7%B1%E7%B4%B9%E4%BB%8B%EF%BC%9A"
                    className="inline-flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 font-semibold transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                    運営に問い合わせる
                  </a>
                </div>
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
                  登録中...
                </span>
              ) : '登録する'}
            </button>
          </form>

          {/* Login link */}
          <p className="mt-7 text-center text-sm text-slate-500">
            すでにアカウントをお持ちの方は{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
