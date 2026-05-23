'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'
import { AlertTriangle, Check, X, Shield, KeyRound, Mail, Lock } from 'lucide-react'

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [passphrase, setPassphrase] = useState('')
  const [newPassphrase, setNewPassphrase] = useState('')
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingEmailVerification, setSavingEmailVerification] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profileData?.is_admin) {
        router.push('/announcements')
        return
      }

      setProfile(profileData)

      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'registration_passphrase')
        .single()

      if (settingsData) {
        setPassphrase(settingsData.value)
        setNewPassphrase(settingsData.value)
      }

      const { data: emailVerificationData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'email_verification_required')
        .single()

      if (emailVerificationData) {
        setEmailVerificationRequired(emailVerificationData.value === 'true')
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassphrase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassphrase.trim()) return

    setSaving(true)
    setMessage(null)

    try {
      const { data: versionData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'passphrase_version')
        .single()

      const currentVersion = parseInt(versionData?.value || '1', 10)
      const newVersion = currentVersion + 1

      const { error: passphraseError } = await supabase
        .from('app_settings')
        .update({ value: newPassphrase.trim(), updated_at: new Date().toISOString() })
        .eq('key', 'registration_passphrase')

      if (passphraseError) throw passphraseError

      const { error: versionError } = await supabase
        .from('app_settings')
        .update({ value: newVersion.toString(), updated_at: new Date().toISOString() })
        .eq('key', 'passphrase_version')

      if (versionError) throw versionError

      setPassphrase(newPassphrase.trim())
      setMessage({ type: 'success', text: '合言葉を更新しました。既存ユーザーは次回ログイン時に新しい合言葉の入力が必要になります。' })
    } catch (error) {
      console.error('Error updating passphrase:', error)
      setMessage({ type: 'error', text: '合言葉の更新に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEmailVerification = async () => {
    setSavingEmailVerification(true)
    setMessage(null)

    const newValue = !emailVerificationRequired

    try {
      const { data: existingData } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'email_verification_required')
        .single()

      if (existingData) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value: newValue.toString(), updated_at: new Date().toISOString() })
          .eq('key', 'email_verification_required')

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({ key: 'email_verification_required', value: newValue.toString() })

        if (error) throw error
      }

      setEmailVerificationRequired(newValue)
      setMessage({
        type: 'success',
        text: newValue
          ? 'メール認証を有効にしました。新規ユーザーはメール認証後にログインできます。'
          : 'メール認証を無効にしました。新規ユーザーは認証なしで即座にログインできます。',
      })
    } catch (error) {
      console.error('Error updating email verification setting:', error)
      setMessage({ type: 'error', text: 'メール認証設定の更新に失敗しました' })
    } finally {
      setSavingEmailVerification(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!profile?.is_admin) {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
          >
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>
            管理者設定
          </h1>
        </div>
        <p className="text-sm text-slate-500 ml-12">システム全体の設定を管理します</p>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`px-5 py-4 rounded-2xl flex items-start gap-3 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-white" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <X className="w-3 h-3 text-white" />
            </div>
          )}
          {message.text}
        </div>
      )}

      {/* Passphrase card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,70,229,0.1)' }}>
            <KeyRound className="w-4 h-4 text-indigo-600" />
          </div>
          <h2 className="text-base font-bold text-slate-900">登録用合言葉の設定</h2>
        </div>

        <form onSubmit={handleUpdatePassphrase} className="space-y-5">
          {/* Current passphrase display */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              現在の合言葉
            </label>
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
              <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <p className="text-sm text-slate-700 font-mono">{passphrase}</p>
            </div>
          </div>

          {/* New passphrase input */}
          <div>
            <label htmlFor="newPassphrase" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              新しい合言葉
            </label>
            <input
              id="newPassphrase"
              type="text"
              value={newPassphrase}
              onChange={(e) => setNewPassphrase(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              placeholder="新しい合言葉を入力"
            />
            <p className="mt-2 text-xs text-slate-400">
              新規登録時にユーザーが入力する合言葉です
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || newPassphrase === passphrase}
            className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
          >
            {saving ? '更新中...' : '合言葉を更新'}
          </button>
        </form>
      </div>

      {/* Email verification card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <Mail className="w-4 h-4 text-emerald-600" />
          </div>
          <h2 className="text-base font-bold text-slate-900">メール認証設定</h2>
        </div>

        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-sm font-semibold text-slate-700">新規登録時のメール認証</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {emailVerificationRequired
                ? 'ON — 新規ユーザーはメールの確認リンクをクリックしてからログインできます'
                : 'OFF — 新規ユーザーはメール認証なしで即座にログインできます'}
            </p>
          </div>
          <button
            onClick={handleToggleEmailVerification}
            disabled={savingEmailVerification}
            className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            style={{ background: emailVerificationRequired ? '#4F46E5' : '#CBD5E1' }}
          >
            <span
              className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              style={{ transform: emailVerificationRequired ? 'translateX(20px)' : 'translateX(0px)' }}
            />
          </button>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>注意:</strong> この設定はSupabaseダッシュボードの「Confirm email」設定と連携して動作します。
            Supabase側で認証メール送信が有効になっている必要があります。
          </p>
        </div>
      </div>
    </div>
  )
}
