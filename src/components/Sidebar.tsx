'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Calendar, MessageSquare, Users, User, Settings, Info } from 'lucide-react'
import type { Profile } from '@/lib/types/database.types'

interface SidebarProps {
  profile: Profile | null
  isOpen?: boolean
  onClose?: () => void
}

const menuItems = [
  { icon: Calendar, label: '全体告知', href: '/announcements', requiresAuth: false },
  { icon: MessageSquare, label: '掲示板', href: '/board', requiresAuth: false },
  { icon: Users, label: '言語パートナー', href: '/teacher', requiresAuth: true, teacherHref: '/teacher', studentHref: '/student' },
  { icon: User, label: 'プロフィール', href: '/student', requiresAuth: true, roleRequired: 'student' as const },
]

export default function Sidebar({ profile, isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()

  const getHref = (item: typeof menuItems[0]) => {
    if (item.teacherHref && item.studentHref && profile) {
      return profile.role === 'teacher' ? item.teacherHref : item.studentHref
    }
    return item.href
  }

  const getLabel = (item: typeof menuItems[0]) => {
    if (item.label === '言語パートナー' && profile?.role === 'teacher') {
      return '先生マッチング'
    }
    return item.label
  }

  return (
    <>
      {/* モバイル用オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* メニュー */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              // 認証が必要な項目で未ログインの場合はスキップ
              if (item.requiresAuth && !profile) return null
              // 特定ロールが必要な項目でロールが一致しない場合はスキップ
              if (item.roleRequired && profile?.role !== item.roleRequired) return null

              const href = getHref(item)
              const isActive = pathname === href
              const Icon = item.icon

              return (
                <Link
                  key={item.label}
                  href={href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{getLabel(item)}</span>
                </Link>
              )
            })}

            {/* 管理者設定 */}
            {profile?.is_admin && (
              <Link
                href="/settings"
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  pathname === '/settings'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span className="font-medium">管理者設定</span>
              </Link>
            )}

            {/* メッセージ（ログインユーザーのみ） */}
            {profile && (
              <Link
                href="/messages"
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  pathname === '/messages'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <MessageSquare className="w-5 h-5" />
                <span className="font-medium">メッセージ</span>
              </Link>
            )}
          </nav>

          {/* 区切り線 */}
          <div className="border-t border-gray-200" />

          {/* 「について」セクション */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Info className="w-4 h-4" />
              <span className="text-sm font-medium">について</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Toronto Language Exchange は、トロントで日本語を学びたい人と教えたい人をつなぐプラットフォームです。
            </p>
          </div>

          {/* 区切り線 */}
          <div className="border-t border-gray-200" />

          {/* ユーザー情報 */}
          <div className="px-4 py-4">
            {profile ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                  {profile.full_name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {profile.full_name || '名前未設定'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {profile.role === 'teacher' ? '先生' : '生徒'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500">ゲストユーザー</p>
                  <Link href="/login" className="text-xs text-indigo-600 hover:underline">
                    ログイン
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
