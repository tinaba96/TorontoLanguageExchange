'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu, LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'
import Avatar from './Avatar'
import NotificationDropdown from './NotificationDropdown'

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
    <header
      className="fixed top-0 left-0 right-0 h-16 z-50 flex items-center"
      style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(226,232,240,0.8)',
        boxShadow: '0 1px 20px rgba(11,22,41,0.06)',
      }}
    >
      <div className="flex items-center justify-between h-full px-4 w-full">
        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-xl hover:bg-slate-100 lg:hidden transition-colors"
            aria-label="メニューを開く"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>

          <Link href="/" className="flex items-center gap-2.5">
            {/* LTOC gradient wordmark */}
            <span
              className="text-xl font-extrabold leading-none"
              style={{
                fontFamily: 'var(--font-syne)',
                background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 60%, #818CF8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              LTOC
            </span>
            {/* Pill tag */}
            <span
              className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide"
              style={{ background: 'rgba(79,70,229,0.08)', color: '#4F46E5' }}
            >
              Language Community
            </span>
          </Link>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          {profile ? (
            <>
              {/* Notification bell */}
              <NotificationDropdown userId={profile.id} />

              {/* Avatar + name link */}
              <Link
                href="/profile"
                className="flex items-center gap-2 ml-1 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                aria-label="プロフィール"
              >
                <Avatar
                  url={profile.avatar_url}
                  name={profile.full_name}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden"
                  imgClassName="w-full h-full object-cover"
                />
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-slate-800 leading-none">{profile.full_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-none">
                    {profile.role === 'teacher' ? 'Japanese Teacher' : 'English Speaker'}
                  </p>
                </div>
              </Link>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                aria-label="ログアウト"
                title="ログアウト"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/board"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">ゲスト</span>
              </Link>

              <Link
                href="/login"
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                ログイン
              </Link>

              <Link
                href="/signup"
                className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
              >
                新規登録
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
