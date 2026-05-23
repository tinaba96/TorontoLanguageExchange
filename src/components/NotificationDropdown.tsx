'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types/database.types'

interface NotificationDropdownProps {
  userId: string
}

const RECENT_LIMIT = 10

export default function NotificationDropdown({ userId }: NotificationDropdownProps) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadUnreadCount()

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadUnreadCount()
          if (open) loadRecent()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, open])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const loadUnreadCount = async () => {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setUnreadCount(count || 0)
  }

  const loadRecent = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT)
    setNotifications((data as Notification[]) || [])
    setLoading(false)
  }

  const handleToggle = async () => {
    const next = !open
    setOpen(next)
    if (next) await loadRecent()
  }

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const handleMarkAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
  }

  const formatDate = (s: string) => {
    const d = new Date(s)
    const diff = Date.now() - d.getTime()
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour
    if (diff < minute) return 'たった今'
    if (diff < hour) return `${Math.floor(diff / minute)}分前`
    if (diff < day) return `${Math.floor(diff / hour)}時間前`
    if (diff < 7 * day) return `${Math.floor(diff / day)}日前`
    return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        className="p-2 rounded-lg hover:bg-gray-100 relative"
        aria-label="通知"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[80vh] flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900">通知</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                すべて既読
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-gray-500">読み込み中...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">通知はありません</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={`w-full text-left p-3 hover:bg-gray-50 transition-colors flex gap-3 ${
                        n.is_read ? '' : 'bg-indigo-50/40'
                      }`}
                    >
                      <span
                        className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                          n.is_read ? 'bg-transparent' : 'bg-indigo-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                        {n.body && (
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.body}</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-1">{formatDate(n.created_at)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-2 border-t">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block w-full text-center py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-md"
            >
              すべて見る
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
