'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'
import RichTextEditor from '@/components/RichTextEditor'

interface Announcement {
  id: string
  user_id: string
  title: string
  content: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  author: Profile
}

export default function AnnouncementsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newIsPinned, setNewIsPinned] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // リアルタイム更新をサブスクライブ
    const channel = supabase
      .channel('announcements-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements',
        },
        () => {
          loadAnnouncements()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile])

  const loadData = async () => {
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

      const profileData = profileResult.data
      const userVersion = profileData?.passphrase_version || 0
      const currentVersion = parseInt(versionResult.data?.value || '1', 10)

      // バージョンが古ければ再認証ページへ
      if (userVersion < currentVersion) {
        router.push('/verify-passphrase')
        return
      }

      setProfile(profileData)
      await loadAnnouncements()
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAnnouncements = async () => {
    try {
      const { data } = await supabase
        .from('announcements')
        .select(`
          *,
          author:user_id(*)
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (data) {
        const formatted: Announcement[] = data.map((item: any) => ({
          ...item,
          author: Array.isArray(item.author) ? item.author[0] : item.author,
        }))
        setAnnouncements(formatted)
      }
    } catch (error) {
      console.error('Error loading announcements:', error)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !newTitle.trim() || !newContent.trim()) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('announcements')
        .insert({
          user_id: profile.id,
          title: newTitle.trim(),
          content: newContent.trim(),
          is_pinned: newIsPinned,
        })

      if (error) throw error

      setNewTitle('')
      setNewContent('')
      setNewIsPinned(false)
      setShowNewModal(false)
    } catch (error) {
      console.error('Error creating announcement:', error)
      alert('告知の作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAnnouncement || !newTitle.trim() || !newContent.trim()) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('announcements')
        .update({
          title: newTitle.trim(),
          content: newContent.trim(),
          is_pinned: newIsPinned,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingAnnouncement.id)

      if (error) throw error

      setNewTitle('')
      setNewContent('')
      setNewIsPinned(false)
      setEditingAnnouncement(null)
    } catch (error) {
      console.error('Error updating announcement:', error)
      alert('告知の更新に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この告知を削除してもよろしいですか？')) return

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting announcement:', error)
      alert('告知の削除に失敗しました')
    }
  }

  const openEditModal = (announcement: Announcement) => {
    setNewTitle(announcement.title)
    setNewContent(announcement.content)
    setNewIsPinned(announcement.is_pinned)
    setEditingAnnouncement(announcement)
  }

  const closeModal = () => {
    setNewTitle('')
    setNewContent('')
    setNewIsPinned(false)
    setShowNewModal(false)
    setEditingAnnouncement(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">全体告知</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/board"
              className="text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              掲示板
            </Link>
            <Link
              href={profile?.role === 'teacher' ? '/teacher' : '/student'}
              className="text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              先生マッチング
            </Link>
            <Link
              href="/messages"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              メッセージ
            </Link>
            {profile?.is_admin && (
              <Link
                href="/settings"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                設定
              </Link>
            )}
            <span className="text-gray-700 font-medium">{profile?.full_name}</span>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Create Button (Admin only) */}
        {profile?.is_admin && (
          <div className="mb-6">
            <button
              onClick={() => setShowNewModal(true)}
              className="w-full bg-white rounded-lg shadow p-4 text-left text-gray-500 hover:text-gray-700 hover:shadow-md transition-all"
            >
              新しい告知を作成...
            </button>
          </div>
        )}

        {/* Announcements List */}
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
              まだ告知がありません。
            </div>
          ) : (
            announcements.map((announcement) => (
              <div
                key={announcement.id}
                className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow ${
                  announcement.is_pinned ? 'border-l-4 border-yellow-500' : ''
                }`}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                        {announcement.author?.full_name?.charAt(0) || 'U'}
                      </div>
                      <div className="ml-3">
                        <p className="font-semibold text-gray-900">
                          {announcement.author?.full_name || '名前未設定'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(announcement.created_at).toLocaleString('ja-JP')}
                        </p>
                      </div>
                    </div>
                    {announcement.is_pinned && (
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                        固定
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{announcement.title}</h3>
                  <div
                    className="text-gray-700 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: announcement.content }}
                  />

                  {/* Actions (Admin only) */}
                  {profile?.is_admin && (
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                      <button
                        onClick={() => openEditModal(announcement)}
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(announcement.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        削除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* New/Edit Modal */}
      {(showNewModal || editingAnnouncement) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingAnnouncement ? '告知を編集' : '新しい告知'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700 text-3xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <form onSubmit={editingAnnouncement ? handleUpdate : handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  タイトル
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="告知のタイトル"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  内容
                </label>
                <RichTextEditor
                  content={newContent}
                  onChange={setNewContent}
                  placeholder="告知の内容を入力してください"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_pinned"
                  checked={newIsPinned}
                  onChange={(e) => setNewIsPinned(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="is_pinned" className="ml-2 text-sm text-gray-700">
                  この告知を固定表示する
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? '処理中...' : editingAnnouncement ? '更新する' : '投稿する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
