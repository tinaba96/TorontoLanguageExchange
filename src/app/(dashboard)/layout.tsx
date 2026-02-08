'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadProfile()

    // 認証状態の変更をリッスン
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadProfile()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setProfile(profileData)
      } else {
        setProfile(null)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header profile={profile} onMenuClick={toggleSidebar} />
      <Sidebar profile={profile} isOpen={sidebarOpen} onClose={closeSidebar} />
      <main className="pt-16 lg:ml-64 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
