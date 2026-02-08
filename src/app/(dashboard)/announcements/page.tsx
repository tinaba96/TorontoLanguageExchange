'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'
import RichTextEditor from '@/components/RichTextEditor'
import { UserPlus, UserCheck, Pin, Clock, X, Pencil, Trash2 } from 'lucide-react'

// ローカルストレージのキー
const ANON_ANNOUNCEMENT_LIKES_KEY = 'anon_announcement_likes'

// 匿名いいねをローカルストレージから取得
const getAnonLikes = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(ANON_ANNOUNCEMENT_LIKES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// 匿名いいねをローカルストレージに保存
const addAnonLike = (announcementId: string) => {
  const likes = getAnonLikes()
  if (!likes.includes(announcementId)) {
    likes.push(announcementId)
    localStorage.setItem(ANON_ANNOUNCEMENT_LIKES_KEY, JSON.stringify(likes))
  }
}

interface LikeUser {
  id: string
  full_name: string
  email: string
  created_at: string
  participant_name?: string
  participant_email?: string
}

interface Announcement {
  id: string
  user_id: string
  title: string
  content: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  author: Profile
  likes_count: number
  user_has_liked: boolean
  liked_users: LikeUser[]
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
  const [showLikesModal, setShowLikesModal] = useState<Announcement | null>(null)
  const [anonLikedAnnouncements, setAnonLikedAnnouncements] = useState<string[]>([])
  const [showJoinModal, setShowJoinModal] = useState<string | null>(null)
  const [joinName, setJoinName] = useState('')
  const [joinEmail, setJoinEmail] = useState('')

  const supabase = createClient()

  useEffect(() => {
    // ローカルストレージから匿名いいねを読み込む
    setAnonLikedAnnouncements(getAnonLikes())
    loadData()
  }, [])

  useEffect(() => {
    // リアルタイム更新をサブスクライブ
    const announcementsChannel = supabase
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

    const likesChannel = supabase
      .channel('announcement-likes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcement_likes',
        },
        () => {
          loadAnnouncements()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(announcementsChannel)
      supabase.removeChannel(likesChannel)
    }
  }, [profile])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // ログインしている場合はプロフィールを取得
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setProfile(profileData)
      }
      // ログインしていなくても告知を読み込む
      await loadAnnouncements()
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAnnouncements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data } = await supabase
        .from('announcements')
        .select(`
          *,
          author:user_id(*),
          announcement_likes(id, user_id, created_at, participant_name, participant_email, user:user_id(id, full_name, email))
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (data) {
        const anonLikes = getAnonLikes()
        const formatted: Announcement[] = data.map((item: any) => ({
          ...item,
          author: Array.isArray(item.author) ? item.author[0] : item.author,
          likes_count: item.announcement_likes?.length || 0,
          // ログインユーザー: DBで確認、匿名ユーザー: ローカルストレージで確認
          user_has_liked: user
            ? item.announcement_likes?.some((like: any) => like.user_id === user.id)
            : anonLikes.includes(item.id),
          liked_users: item.announcement_likes?.map((like: any) => {
            const likeUser = Array.isArray(like.user) ? like.user[0] : like.user
            return {
              id: likeUser?.id || '',
              full_name: like.participant_name || likeUser?.full_name || '名前未設定',
              email: like.participant_email || likeUser?.email || '',
              created_at: like.created_at,
              participant_name: like.participant_name || null,
              participant_email: like.participant_email || null,
            }
          }) || [],
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

  const handleJoinClick = (announcementId: string, hasLiked: boolean) => {
    if (profile) {
      // ログインユーザー: そのまま参加/取消
      handleJoin(announcementId, hasLiked)
    } else {
      if (hasLiked) return // すでに参加済み
      // 未ログインユーザー: ポップアップ表示
      setShowJoinModal(announcementId)
      setJoinName('')
      setJoinEmail('')
    }
  }

  const handleJoin = async (announcementId: string, hasLiked: boolean) => {
    try {
      if (profile) {
        // ログインユーザー: 参加のトグル
        if (hasLiked) {
          const { error } = await supabase
            .from('announcement_likes')
            .delete()
            .eq('announcement_id', announcementId)
            .eq('user_id', profile.id)

          if (error) throw error
        } else {
          const { error } = await supabase
            .from('announcement_likes')
            .insert({
              announcement_id: announcementId,
              user_id: profile.id,
              participant_name: profile.full_name,
            })

          if (error) throw error
        }
      }
      // 告知を再読み込み
      await loadAnnouncements()
    } catch (error) {
      console.error('Error toggling join:', error)
    }
  }

  const handleAnonJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showJoinModal || !joinName.trim()) return

    try {
      const { error } = await supabase
        .from('announcement_likes')
        .insert({
          announcement_id: showJoinModal,
          user_id: null,
          participant_name: joinName.trim(),
          participant_email: joinEmail.trim() || null,
        })

      if (error) throw error

      // ローカルストレージに保存
      addAnonLike(showJoinModal)
      setAnonLikedAnnouncements([...anonLikedAnnouncements, showJoinModal])
      setShowJoinModal(null)
      setJoinName('')
      setJoinEmail('')

      await loadAnnouncements()
    } catch (error) {
      console.error('Error joining:', error)
      alert('参加登録に失敗しました')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-gray-600">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* ページヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">全体告知</h1>
        <p className="text-gray-600 mt-1">運営からのお知らせをお届けします</p>
      </div>

      {/* 投稿作成ボタン（管理者のみ） */}
      {profile?.is_admin && (
        <div className="mb-6">
          <button
            onClick={() => setShowNewModal(true)}
            className="w-full bg-white rounded-lg shadow p-4 text-left text-gray-500 hover:text-gray-700 hover:shadow-md transition-all border border-gray-200"
          >
            新しい告知を作成...
          </button>
        </div>
      )}

      {/* 告知リスト（横長カード） */}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
            まだ告知がありません。
          </div>
        ) : (
          announcements.map((announcement) => (
            <div
              key={announcement.id}
              className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow border ${
                announcement.is_pinned ? 'border-yellow-300' : 'border-gray-200'
              }`}
            >
              <div className="flex flex-col md:flex-row">
                {/* 左側: 画像エリア（プレースホルダー） */}
                <div className={`w-full md:w-48 h-32 md:h-auto flex items-center justify-center rounded-t-lg md:rounded-l-lg md:rounded-tr-none flex-shrink-0 ${
                  announcement.is_pinned
                    ? 'bg-gradient-to-br from-yellow-100 to-orange-100'
                    : 'bg-gradient-to-br from-blue-100 to-indigo-100'
                }`}>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl ${
                    announcement.is_pinned
                      ? 'bg-yellow-200 text-yellow-700'
                      : 'bg-indigo-200 text-indigo-600'
                  }`}>
                    {announcement.author?.full_name?.charAt(0) || 'U'}
                  </div>
                </div>

                {/* 右側: コンテンツ */}
                <div className="flex-1 p-5">
                  {/* タイトルと作者 */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      {announcement.is_pinned && (
                        <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                          <Pin className="w-3 h-3" />
                          固定
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-gray-900">{announcement.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="font-medium">{announcement.author?.full_name || '名前未設定'}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(announcement.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 内容（2行で切り捨て） */}
                  <div
                    className="text-gray-700 mb-4 line-clamp-2 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: announcement.content }}
                  />

                  {/* アクションボタン */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleJoinClick(announcement.id, announcement.user_has_liked)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          announcement.user_has_liked
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        {announcement.user_has_liked ? (
                          <UserCheck className="w-4 h-4" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        <span>
                          {announcement.user_has_liked ? '参加済み' : '参加する'}
                        </span>
                        {announcement.likes_count > 0 && (
                          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                            announcement.user_has_liked
                              ? 'bg-white/20'
                              : 'bg-indigo-100'
                          }`}>
                            {announcement.likes_count}
                          </span>
                        )}
                      </button>
                      {/* Admin: View participants list */}
                      {profile?.is_admin && announcement.likes_count > 0 && (
                        <button
                          onClick={() => setShowLikesModal(announcement)}
                          className="text-indigo-600 hover:text-indigo-700 text-sm font-medium underline"
                        >
                          参加者一覧
                        </button>
                      )}
                    </div>

                    {/* Actions (Admin only) */}
                    {profile?.is_admin && (
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => openEditModal(announcement)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(announcement.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Likes List Modal (Admin only) */}
      {showLikesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  参加者一覧 ({showLikesModal.likes_count}人)
                </h2>
                <button
                  onClick={() => setShowLikesModal(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">{showLikesModal.title}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {showLikesModal.liked_users.length === 0 ? (
                <p className="text-gray-500 text-center py-4">参加者はいません</p>
              ) : (
                <div className="space-y-3">
                  {showLikesModal.liked_users.map((user, index) => {
                    const isAnon = !user.id && user.participant_name
                    return (
                      <div
                        key={user.id || `anon-${index}`}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            isAnon
                              ? 'bg-gray-200 text-gray-500'
                              : 'bg-indigo-100 text-indigo-600'
                          }`}>
                            {user.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{user.full_name}</p>
                              {isAnon && (
                                <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">ゲスト</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{user.email || '—'}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">
                          {formatDate(user.created_at)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <button
                onClick={() => setShowLikesModal(null)}
                className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anonymous Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">参加登録</h2>
                <button
                  onClick={() => {
                    setShowJoinModal(null)
                    setJoinName('')
                    setJoinEmail('')
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">参加するにはお名前を入力してください</p>
            </div>
            <form onSubmit={handleAnonJoin} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="お名前を入力"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-gray-400 text-xs">（任意）</span>
                </label>
                <input
                  type="email"
                  value={joinEmail}
                  onChange={(e) => setJoinEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="example@email.com"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinModal(null)
                    setJoinName('')
                    setJoinEmail('')
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={!joinName.trim()}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  参加する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
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
