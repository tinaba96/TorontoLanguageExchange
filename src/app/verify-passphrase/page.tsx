'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-xl text-gray-700">確認中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">
          合言葉の再認証
        </h1>
        <p className="text-center text-gray-600 mb-8">
          合言葉が更新されました。新しい合言葉を入力してください。
        </p>

        <form onSubmit={handleVerify} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

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
              placeholder="新しい合言葉を入力"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '認証中...' : '認証する'}
          </button>
        </form>
      </div>
    </div>
  )
}
