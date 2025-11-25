import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'

export function usePassphraseCheck() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkPassphrase()
  }, [])

  const checkPassphrase = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // プロフィールとpassphrase_versionを取得
      const [profileResult, versionResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single(),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'passphrase_version')
          .single()
      ])

      if (!profileResult.data) {
        router.push('/login')
        return
      }

      const userVersion = profileResult.data.passphrase_version || 0
      const currentVersion = parseInt(versionResult.data?.value || '1', 10)

      // バージョンが古ければ再認証ページへ
      if (userVersion < currentVersion) {
        router.push('/verify-passphrase')
        return
      }

      setProfile(profileResult.data)
    } catch (error) {
      console.error('Error checking passphrase:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  return { profile, loading, setProfile }
}
