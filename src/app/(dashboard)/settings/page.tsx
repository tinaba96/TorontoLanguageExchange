'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'
import { AlertTriangle, Check, X } from 'lucide-react'

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

      // 現在の合言葉を取得
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'registration_passphrase')
        .single()

      if (settingsData) {
        setPassphrase(settingsData.value)
        setNewPassphrase(settingsData.value)
      }

      // メール認証設定を取得
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
      // 現在のバージョンを取得
      const { data: versionData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'passphrase_version')
        .single()

      const currentVersion = parseInt(versionData?.value || '1', 10)
      const newVersion = currentVersion + 1

      // 合言葉を更新
      const { error: passphraseError } = await supabase
        .from('app_settings')
        .update({
          value: newPassphrase.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('key', 'registration_passphrase')

      if (passphraseError) throw passphraseError

      // バージョンをインクリメント
      const { error: versionError } = await supabase
        .from('app_settings')
        .update({
          value: newVersion.toString(),
          updated_at: new Date().toISOString(),
        })
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
      // 設定が存在するか確認
      const { data: existingData } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'email_verification_required')
        .single()

      if (existingData) {
        // 更新
        const { error } = await supabase
          .from('app_settings')
          .update({
            value: newValue.toString(),
            updated_at: new Date().toISOString(),
          })
          .eq('key', 'email_verification_required')

        if (error) throw error
      } else {
        // 新規作成
        const { error } = await supabase
          .from('app_settings')
          .insert({
            key: 'email_verification_required',
            value: newValue.toString(),
          })

        if (error) throw error
      }

      setEmailVerificationRequired(newValue)
      setMessage({
        type: 'success',
        text: newValue
          ? 'メール認証を有効にしました。新規ユーザーはメール認証後にログインできます。'
          : 'メール認証を無効にしました。新規ユーザーは認証なしでログインできます。',
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
        <div className="text-xl text-gray-600">読み込み中...</div>
      </div>
    )
  }

  if (!profile?.is_admin) {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* ページヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">管理者設定</h1>
        <p className="text-gray-600 mt-1">システム全体の設定を管理します</p>
      </div>

      {/* メッセージ表示 */}
      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <X className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          {message.text}
        </div>
      )}

      {/* 合言葉設定 */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">登録用合言葉の設定</h2>

        <form onSubmit={handleUpdatePassphrase} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              現在の合言葉
            </label>
            <p className="text-gray-900 bg-gray-100 px-4 py-2 rounded-lg font-mono">
              {passphrase}
            </p>
          </div>

          <div>
            <label htmlFor="newPassphrase" className="block text-sm font-medium text-gray-700 mb-2">
              新しい合言葉
            </label>
            <input
              id="newPassphrase"
              type="text"
              value={newPassphrase}
              onChange={(e) => setNewPassphrase(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="新しい合言葉を入力"
            />
            <p className="mt-1 text-sm text-gray-500">
              新規登録時にユーザーが入力する合言葉です
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || newPassphrase === passphrase}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '更新中...' : '合言葉を更新'}
          </button>
        </form>
      </div>

      {/* メール認証設定 */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">メール認証設定</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-900 font-medium">新規登録時のメール認証</p>
            <p className="text-sm text-gray-500 mt-1">
              {emailVerificationRequired
                ? 'ONの場合、新規ユーザーはメールの確認リンクをクリックしてからログインできます'
                : 'OFFの場合、新規ユーザーはメール認証なしで即座にログインできます'}
            </p>
          </div>
          <button
            onClick={handleToggleEmailVerification}
            disabled={savingEmailVerification}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
              emailVerificationRequired ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                emailVerificationRequired ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">
            <strong>注意:</strong> この設定はSupabaseダッシュボードの「Confirm email」設定と連携して動作します。
            Supabase側で認証メール送信が有効になっている必要があります。
          </p>
        </div>
      </div>
    </div>
  )
}
