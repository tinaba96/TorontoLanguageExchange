'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck } from 'lucide-react'

export default function VerifyPassphrasePage() {
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkIfVerificationNeeded()
  }, [])

  const checkIfVerificationNeeded = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // ユーザーのpassphrase_versionと現在のバージョンを比較
      const [profileResult, versionResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('passphrase_version')
          .eq('id', user.id)
          .single(),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'passphrase_version')
          .single()
      ])

      const userVersion = profileResult.data?.passphrase_version || 0
      const currentVersion = parseInt(versionResult.data?.value || '1', 10)

      // バージョンが一致していれば認証不要
      if (userVersion >= currentVersion) {
        router.push('/announcements')
        return
      }
    } catch (error) {
      console.error('Error checking verification:', error)
    } finally {
      setChecking(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // 合言葉とバージョンを取得
      const [passphraseResult, versionResult] = await Promise.all([
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'registration_passphrase')
          .single(),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'passphrase_version')
          .single()
      ])

      if (passphrase !== passphraseResult.data?.value) {
        throw new Error('合言葉が正しくありません')
      }

      // 合言葉が正しければ、ユーザーのpassphrase_versionを更新
      const currentVersion = parseInt(versionResult.data?.value || '1', 10)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ passphrase_version: currentVersion })
        .eq('id', user.id)

      if (updateError) throw updateError

      router.push('/announcements')
    } catch (err: any) {
      console.error('Verification error:', err)
      setError(err.message || '認証に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1629' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">確認中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0B1629' }}>
      {/* Background grid */}
      <div className="fixed inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-white mb-2" style={{ fontFamily: 'var(--font-syne)' }}>
              合言葉の再認証
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              合言葉が更新されました。<br />新しい合言葉を入力してください。
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl text-sm text-red-300"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <label htmlFor="passphrase" className="block text-sm font-medium text-slate-300 mb-2">
                  合言葉
                </label>
                <input
                  id="passphrase"
                  type="text"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 rounded-xl text-white placeholder-slate-500 text-sm transition-all outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,102,241,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                  onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
                  placeholder="新しい合言葉を入力"
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', boxShadow: '0 0 30px rgba(79,70,229,0.25)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    認証中...
                  </span>
                ) : '認証する'}
              </button>
            </form>
          </div>
        </div>

        {/* LTOC branding below card */}
        <p className="text-center mt-6 text-slate-600 text-xs">
          <span style={{ fontFamily: 'var(--font-syne)', color: '#6366F1', fontWeight: 700 }}>LTOC</span>
          {' '}Toronto Language Community
        </p>
      </div>
    </div>
  )
}
