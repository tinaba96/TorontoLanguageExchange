'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types/database.types'
import { Check, Trash2, Bell } from 'lucide-react'

type Filter = 'all' | 'unread'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      channel = supabase
        .channel(`notifications-page-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => loadAll()
        )
        .subscribe()
    })()
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const loadAll = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (filter === 'unread') query = query.eq('is_read', false)
      const { data } = await query
      setNotifications((data as Notification[]) || [])
    } finally {
      setLoading(false)
    }
  }

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    if (n.link) router.push(n.link)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('この通知を削除しますか？')) return
    await supabase.from('notifications').delete().eq('id', id)
  }

  const handleMarkAllRead = async () => {
    if (!userId) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
  }

  const formatDate = (s: string) => {
    const d = new Date(s)
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">通知</h1>
          <p className="text-gray-600 mt-1">最新100件まで表示</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === 'all' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
              }`}
            >
              すべて
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === 'unread' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
              }`}
            >
              未読
            </button>
          </div>
          <button
            onClick={handleMarkAllRead}
            className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-md flex items-center gap-1"
          >
            <Check className="w-4 h-4" />
            すべて既読
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        {loading ? (
          <div className="p-10 text-center text-gray-500">読み込み中...</div>
        ) : notifications.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>{filter === 'unread' ? '未読の通知はありません' : '通知はまだありません'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {notifications.map((n) => (
              <li key={n.id}>
                <div
                  onClick={() => handleClick(n)}
                  className={`p-4 flex gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                    n.is_read ? '' : 'bg-indigo-50/40'
                  }`}
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      n.is_read ? 'bg-transparent' : 'bg-indigo-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                    {n.body && (
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{n.body}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1.5">{formatDate(n.created_at)}</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, n.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    aria-label="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
