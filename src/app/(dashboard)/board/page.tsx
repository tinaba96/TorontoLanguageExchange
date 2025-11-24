'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'

interface Post {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  author: Profile
  likes_count: number
  comments_count: number
  user_has_liked: boolean
}

interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  author: Profile
}

export default function BulletinBoardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewPostModal, setShowNewPostModal] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newPostTitle, setNewPostTitle] = useState('')
  const [newPostContent, setNewPostContent] = useState('')
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // リアルタイム更新をサブスクライブ
    const postsChannel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
        },
        () => {
          loadPosts()
        }
      )
      .subscribe()

    const likesChannel = supabase
      .channel('likes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_likes',
        },
        () => {
          loadPosts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(postsChannel)
      supabase.removeChannel(likesChannel)
    }
  }, [profile])

  useEffect(() => {
    if (selectedPost) {
      loadComments(selectedPost.id)

      // コメントのリアルタイム更新
      const commentsChannel = supabase
        .channel(`comments-${selectedPost.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'comments',
            filter: `post_id=eq.${selectedPost.id}`,
          },
          () => {
            loadComments(selectedPost.id)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(commentsChannel)
      }
    }
  }, [selectedPost])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profileData)
      await loadPosts()
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: postsData } = await supabase
        .from('posts')
        .select(`
          *,
          author:user_id(*)
        `)
        .order('created_at', { ascending: false })

      if (postsData) {
        const postsWithCounts = await Promise.all(
          postsData.map(async (post: any) => {
            // いいね数を取得
            const { count: likesCount } = await supabase
              .from('post_likes')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id)

            // コメント数を取得
            const { count: commentsCount } = await supabase
              .from('comments')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id)

            // ユーザーがいいねしているか確認
            const { data: userLike } = await supabase
              .from('post_likes')
              .select('id')
              .eq('post_id', post.id)
              .eq('user_id', user.id)
              .single()

            return {
              ...post,
              author: Array.isArray(post.author) ? post.author[0] : post.author,
              likes_count: likesCount || 0,
              comments_count: commentsCount || 0,
              user_has_liked: !!userLike,
            }
          })
        )

        setPosts(postsWithCounts)
      }
    } catch (error) {
      console.error('Error loading posts:', error)
    }
  }

  const loadComments = async (postId: string) => {
    try {
      const { data } = await supabase
        .from('comments')
        .select(`
          *,
          author:user_id(*)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (data) {
        const formattedComments: Comment[] = data.map((comment: any) => ({
          ...comment,
          author: Array.isArray(comment.author) ? comment.author[0] : comment.author,
        }))
        setComments(formattedComments)
      }
    } catch (error) {
      console.error('Error loading comments:', error)
    }
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !newPostTitle.trim() || !newPostContent.trim()) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: profile.id,
          title: newPostTitle.trim(),
          content: newPostContent.trim(),
        })

      if (error) throw error

      setNewPostTitle('')
      setNewPostContent('')
      setShowNewPostModal(false)
    } catch (error) {
      console.error('Error creating post:', error)
      alert('投稿の作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLikeToggle = async (post: Post) => {
    if (!profile) return

    try {
      if (post.user_has_liked) {
        // いいねを解除
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', profile.id)

        if (error) throw error
      } else {
        // いいねを追加
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: post.id,
            user_id: profile.id,
          })

        if (error) throw error
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !selectedPost || !newComment.trim()) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: selectedPost.id,
          user_id: profile.id,
          content: newComment.trim(),
        })

      if (error) throw error

      setNewComment('')
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('コメントの投稿に失敗しました')
    } finally {
      setSubmitting(false)
    }
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
          <h1 className="text-2xl font-bold text-indigo-600">掲示板</h1>
          <div className="flex items-center gap-4">
            <Link
              href={profile?.role === 'teacher' ? '/teacher' : '/student'}
              className="text-indigo-600 hover:text-indigo-700"
            >
              ダッシュボード
            </Link>
            <Link
              href="/messages"
              className="text-indigo-600 hover:text-indigo-700"
            >
              メッセージ
            </Link>
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
        {/* Create Post Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowNewPostModal(true)}
            className="w-full bg-white rounded-lg shadow p-4 text-left text-gray-500 hover:text-gray-700 hover:shadow-md transition-all"
          >
            今日はどんなことをシェアしますか？
          </button>
        </div>

        {/* Posts List */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
              まだ投稿がありません。最初の投稿をしてみましょう！
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-6">
                  {/* Author Info */}
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                      {post.author?.full_name?.charAt(0) || 'U'}
                    </div>
                    <div className="ml-3">
                      <p className="font-semibold text-gray-900">{post.author?.full_name || '名前未設定'}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(post.created_at).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  </div>

                  {/* Post Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{post.title}</h3>
                  <p className="text-gray-700 mb-4 whitespace-pre-wrap">{post.content}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-6 pt-4 border-t">
                    <button
                      onClick={() => handleLikeToggle(post)}
                      className={`flex items-center gap-2 transition-colors ${
                        post.user_has_liked
                          ? 'text-red-600 hover:text-red-700'
                          : 'text-gray-600 hover:text-red-600'
                      }`}
                    >
                      <span className="text-xl">{post.user_has_liked ? '❤️' : '🤍'}</span>
                      <span className="font-semibold">{post.likes_count}</span>
                    </button>
                    <button
                      onClick={() => setSelectedPost(post)}
                      className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
                    >
                      <span className="text-xl">💬</span>
                      <span className="font-semibold">{post.comments_count}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* New Post Modal */}
      {showNewPostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">新しい投稿</h2>
                <button
                  onClick={() => setShowNewPostModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-3xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <form onSubmit={handleCreatePost} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  タイトル
                </label>
                <input
                  type="text"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="投稿のタイトル"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  内容
                </label>
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  required
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="シェアしたいことを書いてください"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewPostModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? '投稿中...' : '投稿する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Detail Modal (with comments) */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">{selectedPost.title}</h2>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="text-gray-500 hover:text-gray-700 text-3xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Original Post */}
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                    {selectedPost.author?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="ml-3">
                    <p className="font-semibold text-gray-900">{selectedPost.author?.full_name || '名前未設定'}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(selectedPost.created_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedPost.content}</p>
              </div>

              {/* Comments Section */}
              <div className="border-t pt-6">
                <h3 className="font-bold text-gray-900 mb-4">
                  コメント ({comments.length})
                </h3>

                {/* Comment Form */}
                <form onSubmit={handleAddComment} className="mb-6">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="コメントを入力..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={submitting || !newComment.trim()}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      送信
                    </button>
                  </div>
                </form>

                {/* Comments List */}
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-center text-gray-500">まだコメントがありません</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                            {comment.author?.full_name?.charAt(0) || 'U'}
                          </div>
                          <div className="ml-2">
                            <p className="font-semibold text-sm text-gray-900">
                              {comment.author?.full_name || '名前未設定'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(comment.created_at).toLocaleString('ja-JP')}
                            </p>
                          </div>
                        </div>
                        <p className="text-gray-700 text-sm">{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
