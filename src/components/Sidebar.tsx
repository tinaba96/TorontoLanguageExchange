'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar,
  CalendarCheck,
  MessageSquare,
  Users,
  User,
  Settings,
  Megaphone,
  Bell,
  Globe,
  BookOpen,
} from 'lucide-react'
import type { Profile } from '@/lib/types/database.types'
import Avatar from './Avatar'

interface SidebarProps {
  profile: Profile | null
  isOpen?: boolean
  onClose?: () => void
}

interface NavItem {
  icon: any
  label: string
  href: string
  requiresAuth: boolean
  roleRequired?: 'teacher' | 'student'
  badge?: string
}

const publicItems: NavItem[] = [
  { icon: Megaphone, label: '全体告知', href: '/announcements', requiresAuth: false },
  { icon: BookOpen, label: '掲示板', href: '/board', requiresAuth: false },
]

const communityItems: NavItem[] = [
  { icon: Users, label: '生徒を探す', href: '/students', requiresAuth: true, roleRequired: 'teacher' },
  { icon: User, label: 'プロフィール', href: '/student', requiresAuth: true, roleRequired: 'student' },
]

const accountItems: NavItem[] = [
  { icon: MessageSquare, label: 'メッセージ', href: '/messages', requiresAuth: true },
  { icon: CalendarCheck, label: '予約一覧', href: '/bookings', requiresAuth: true },
  { icon: Bell, label: '通知', href: '/notifications', requiresAuth: true },
]

function NavSection({
  title,
  items,
  profile,
  pathname,
  onClose,
}: {
  title: string
  items: NavItem[]
  profile: Profile | null
  pathname: string
  onClose?: () => void
}) {
  const visible = items.filter((item) => {
    if (item.requiresAuth && !profile) return false
    if (item.roleRequired && profile?.role !== item.roleRequired) return false
    return true
  })

  if (visible.length === 0) return null

  return (
    <div className="mb-1">
      <p className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-slate-400">{title}</p>
      <div className="space-y-0.5">
        {visible.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`group flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              style={isActive ? { background: 'linear-gradient(135deg, #4F46E5, #6366F1)' } : {}}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              <span className={`text-sm font-medium ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </span>
              {item.badge && (
                <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function Sidebar({ profile, isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()

  const roleLabel = profile?.role === 'teacher' ? 'Japanese Teacher' : 'English Speaker'

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
        style={{
          background: '#ffffff',
          borderRight: '1px solid rgba(226,232,240,0.8)',
          boxShadow: '2px 0 20px rgba(11,22,41,0.04)',
        }}
      >
        {/* Top section: community tag */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 px-2 py-2 rounded-xl" style={{ background: 'rgba(79,70,229,0.05)' }}>
            <Globe className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-indigo-600 leading-none">LTOC</p>
              <p className="text-xs text-slate-400 truncate leading-none mt-0.5">Toronto Language Community</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          <NavSection
            title="Community"
            items={publicItems}
            profile={profile}
            pathname={pathname}
            onClose={onClose}
          />

          {profile && (
            <NavSection
              title="Lessons"
              items={communityItems}
              profile={profile}
              pathname={pathname}
              onClose={onClose}
            />
          )}

          {profile && (
            <NavSection
              title="Account"
              items={accountItems}
              profile={profile}
              pathname={pathname}
              onClose={onClose}
            />
          )}

          {/* Admin settings */}
          {profile?.is_admin && (
            <div className="mb-1">
              <p className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-slate-400">Admin</p>
              <div className="space-y-0.5">
                <Link
                  href="/settings"
                  onClick={onClose}
                  className={`group flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                    pathname === '/settings'
                      ? 'text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  style={pathname === '/settings' ? { background: 'linear-gradient(135deg, #4F46E5, #6366F1)' } : {}}
                >
                  <Settings className={`w-4 h-4 flex-shrink-0 ${pathname === '/settings' ? 'text-white' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${pathname === '/settings' ? 'text-white' : ''}`}>管理者設定</span>
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* Bottom: user card */}
        <div className="border-t border-slate-100 p-3">
          {profile ? (
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: 'rgba(79,70,229,0.04)' }}>
              <Avatar
                url={profile.avatar_url}
                name={profile.full_name}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden"
                imgClassName="w-full h-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate leading-none">
                  {profile.full_name || '名前未設定'}
                </p>
                <p className="text-xs text-slate-400 mt-1 leading-none truncate">{roleLabel}</p>
              </div>
            </div>
          ) : (
            <div className="px-3 py-3 rounded-xl" style={{ background: 'rgba(79,70,229,0.04)' }}>
              <p className="text-xs text-slate-500 mb-2">ゲストとして閲覧中</p>
              <Link
                href="/login"
                className="block text-center py-2 rounded-lg text-xs font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
              >
                ログイン
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
