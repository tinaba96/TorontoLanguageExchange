'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types/database.types'
import { Check, Trash2, Bell, CheckCheck } from 'lucide-react'

type Filter = 'all' | 'unread'

const typeColors: Record<string, { dot: string; bg: string }> = {
  match: { dot: '#4F46E5', bg: 'rgba(79,70,229,0.08)' },
  message: { dot: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  booking: { dot: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  default: { dot: '#6366F1', bg: 'rgba(99,102,241,0.06)' },
}

function getTypeStyle(type?: string) {
  const key = type && typeColors[type] ? type : 'default'
  return typeColors[key]
}

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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => loadAll())
        .subscribe()
    })()
    return () => { if (channel) supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const loadAll = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      let query = supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
      if (filter === 'unread') query = query.eq('is_read', false)
      const { data } = await query
      setNotifications((data as Notification[]) || [])
    } finally { setLoading(false) }
  }

  const handleClick = async (n: Notification) => {
    if (!n.is_read) { await supabase.from('notifications').update({ is_read: true }).eq('id', n.id) }
    if (n.link) router.push(n.link)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('この通知を削除しますか？')) return
    await supabase.from('notifications').delete().eq('id', id)
  }

  const handleMarkAllRead = async () => {
    if (!userId) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  }

  const formatDate = (s: string) => new Date(s).toLocaleString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-indigo-500" />
            <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>通知</h1>
            {unreadCount > 0 && (
              <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                {unreadCount}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">最新100件まで表示</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab bar */}
          <div className="flex p-1 rounded-xl gap-1" style={{ background: '#F1F5F9' }}>
            {(['all', 'unread'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all"
                style={filter === f ? { background: 'white', color: '#0B1629', boxShadow: '0 1px 4px rgba(11,22,41,0.1)' } : { color: '#64748B' }}
              >
                {f === 'all' ? 'すべて' : '未読'}
              </button>
            ))}
          </div>

          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-xl transition-colors"
            style={{ color: '#4F46E5', background: 'rgba(79,70,229,0.07)' }}
          >
            <CheckCheck className="w-4 h-4" />
            すべて既読
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">読み込み中...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(79,70,229,0.07)' }}>
              <Bell className="w-8 h-8 text-indigo-300" />
            </div>
            <p className="text-slate-500 font-medium">{filter === 'unread' ? '未読の通知はありません' : '通知はまだありません'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {notifications.map((n) => {
              const style = getTypeStyle((n as any).type)
              return (
                <li key={n.id}>
                  <div
                    onClick={() => handleClick(n)}
                    className={`flex gap-4 p-4 cursor-pointer transition-all hover:bg-slate-50 ${!n.is_read ? 'bg-indigo-50/30' : ''}`}
                  >
                    {/* Indicator dot */}
                    <div className="pt-1.5 flex-shrink-0">
                      <div
                        className="w-2 h-2 rounded-full transition-all"
                        style={{ background: n.is_read ? 'transparent' : style.dot, boxShadow: n.is_read ? 'none' : `0 0 6px ${style.dot}` }}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-snug ${n.is_read ? 'text-slate-600' : 'text-slate-900'}`}>{n.title}</p>
                      {n.body && (
                        <p className="text-sm text-slate-500 mt-1 leading-relaxed whitespace-pre-wrap">{n.body}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">{formatDate(n.created_at)}</p>
                    </div>

                    {/* Delete btn */}
                    <button
                      onClick={(e) => handleDelete(e, n.id)}
                      className="flex-shrink-0 self-start p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      aria-label="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
