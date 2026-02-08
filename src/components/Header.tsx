'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu, Bell, LogOut, Key, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'

interface HeaderProps {
  profile: Profile | null
  onMenuClick?: () => void
}

export default function Header({ profile, onMenuClick }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
      <div className="flex items-center justify-between h-full px-4">
        {/* 左側: ハンバーガーメニュー + ロゴ */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
            aria-label="メニューを開く"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-indigo-600">LTOC</span>
            <span className="hidden md:inline text-sm text-gray-500">
              Toronto Language Exchange
            </span>
          </Link>
        </div>

        {/* 右側: ユーザー情報・アクション */}
        <div className="flex items-center gap-2">
          {profile ? (
            <>
              {/* 通知アイコン */}
              <button
                className="p-2 rounded-lg hover:bg-gray-100 relative"
                aria-label="通知"
              >
                <Bell className="w-5 h-5 text-gray-600" />
              </button>

              {/* ユーザーアバター */}
              <div className="flex items-center gap-2 ml-2">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                  {profile.full_name?.charAt(0) || 'U'}
                </div>
                <span className="hidden md:inline text-sm font-medium text-gray-700">
                  {profile.full_name}
                </span>
              </div>

              {/* ログアウトボタン */}
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="ログアウト"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              {/* 未ログイン時 */}
              <Link
                href="/board"
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Public User</span>
              </Link>

              <Link
                href="/login"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Key className="w-4 h-4" />
                <span>ログイン</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
