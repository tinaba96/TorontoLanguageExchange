'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'
import { Heart, MessageCircle, Clock, X } from 'lucide-react'

interface Post {
  id: string
  user_id: string
  title: string
  content: string
  author_name: string | null
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
  author_name: string | null
  created_at: string
  author: Profile
}

// ローカルストレージのキー
const ANON_LIKES_KEY = 'anon_post_likes'

// 匿名いいねをローカルストレージから取得
const getAnonLikes = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(ANON_LIKES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// 匿名いいねをローカルストレージに保存
const addAnonLike = (postId: string) => {
  const likes = getAnonLikes()
  if (!likes.includes(postId)) {
    likes.push(postId)
    localStorage.setItem(ANON_LIKES_KEY, JSON.stringify(likes))
  }
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
  const [newPostAuthor, setNewPostAuthor] = useState('')
  const [newComment, setNewComment] = useState('')
  const [newCommentAuthor, setNewCommentAuthor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [anonLikedPosts, setAnonLikedPosts] = useState<string[]>([])

  const supabase = createClient()

  useEffect(() => {
    // ローカルストレージから匿名いいねを読み込む
    setAnonLikedPosts(getAnonLikes())
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

      if (user) {
        // ログインしている場合はプロフィールを取得
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setProfile(profileData)
      }
      // ログインしていなくても投稿を読み込む
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
            let userHasLiked = false
            if (user) {
              // ログインユーザー: DBで確認
              const { data: userLike } = await supabase
                .from('post_likes')
                .select('id')
                .eq('post_id', post.id)
                .eq('user_id', user.id)
                .single()
              userHasLiked = !!userLike
            } else {
              // 匿名ユーザー: ローカルストレージで確認
              userHasLiked = getAnonLikes().includes(post.id)
            }

            return {
              ...post,
              author: Array.isArray(post.author) ? post.author[0] : post.author,
              likes_count: likesCount || 0,
              comments_count: commentsCount || 0,
              user_has_liked: userHasLiked,
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
    if (!newPostTitle.trim() || !newPostContent.trim() || !newPostAuthor.trim()) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: profile?.id || null,
          title: newPostTitle.trim(),
          content: newPostContent.trim(),
          author_name: newPostAuthor.trim(),
        })

      if (error) throw error

      setNewPostTitle('')
      setNewPostContent('')
      setNewPostAuthor('')
      setShowNewPostModal(false)
    } catch (error) {
      console.error('Error creating post:', error)
      alert('投稿の作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLikeToggle = async (post: Post) => {
    try {
      if (profile) {
        // ログインユーザー: いいねのトグル
        if (post.user_has_liked) {
          const { error } = await supabase
            .from('post_likes')
            .delete()
            .eq('post_id', post.id)
            .eq('user_id', profile.id)

          if (error) throw error
        } else {
          const { error } = await supabase
            .from('post_likes')
            .insert({
              post_id: post.id,
              user_id: profile.id,
            })

          if (error) throw error
        }
      } else {
        // 匿名ユーザー: ローカルストレージでチェック
        if (anonLikedPosts.includes(post.id)) {
          // すでにいいね済み - 何もしない
          return
        }
        // いいねを追加
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: post.id,
            user_id: null,
          })

        if (error) throw error

        // ローカルストレージに保存
        addAnonLike(post.id)
        setAnonLikedPosts([...anonLikedPosts, post.id])
      }
      // 投稿一覧を再読み込み
      await loadPosts()
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPost || !newComment.trim() || !newCommentAuthor.trim()) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: selectedPost.id,
          user_id: profile?.id || null,
          content: newComment.trim(),
          author_name: newCommentAuthor.trim(),
        })

      if (error) throw error

      setNewComment('')
      setNewCommentAuthor('')
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('コメントの投稿に失敗しました')
    } finally {
      setSubmitting(false)
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
        <h1 className="text-2xl font-bold text-gray-900">掲示板</h1>
        <p className="text-gray-600 mt-1">みんなで情報をシェアしましょう</p>
      </div>

      {/* 投稿作成ボタン */}
      <div className="mb-6">
        <button
          onClick={() => setShowNewPostModal(true)}
          className="w-full bg-white rounded-lg shadow p-4 text-left text-gray-500 hover:text-gray-700 hover:shadow-md transition-all border border-gray-200"
        >
          今日はどんなことをシェアしますか？
        </button>
      </div>

      {/* 投稿リスト（横長カード） */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
            まだ投稿がありません。最初の投稿をしてみましょう！
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200"
            >
              <div className="flex flex-col md:flex-row">
                {/* 左側: 画像エリア（プレースホルダー） */}
                <div className="w-full md:w-48 h-32 md:h-auto bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center rounded-t-lg md:rounded-l-lg md:rounded-tr-none flex-shrink-0">
                  <div className="w-16 h-16 bg-indigo-200 rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl">
                    {(post.author_name || post.author?.full_name || 'U').charAt(0)}
                  </div>
                </div>

                {/* 右側: コンテンツ */}
                <div className="flex-1 p-5">
                  {/* タイトルと作者 */}
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{post.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="font-medium">{post.author_name || post.author?.full_name || '名前未設定'}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 内容（2行で切り捨て） */}
                  <p className="text-gray-700 mb-4 line-clamp-2">{post.content}</p>

                  {/* アクションボタン */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleLikeToggle(post)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                        post.user_has_liked
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${post.user_has_liked ? 'fill-current' : ''}`} />
                      <span className="font-medium">{post.likes_count}</span>
                    </button>
                    <button
                      onClick={() => setSelectedPost(post)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="font-medium">{post.comments_count}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
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
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>
            <form onSubmit={handleCreatePost} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  お名前
                </label>
                <input
                  type="text"
                  value={newPostAuthor}
                  onChange={(e) => setNewPostAuthor(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="表示される名前"
                />
              </div>
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
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Original Post */}
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                    {(selectedPost.author_name || selectedPost.author?.full_name || 'U').charAt(0)}
                  </div>
                  <div className="ml-3">
                    <p className="font-semibold text-gray-900">{selectedPost.author_name || selectedPost.author?.full_name || '名前未設定'}</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(selectedPost.created_at)}
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
                <form onSubmit={handleAddComment} className="mb-6 space-y-2">
                  <input
                    type="text"
                    value={newCommentAuthor}
                    onChange={(e) => setNewCommentAuthor(e.target.value)}
                    placeholder="お名前"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
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
                      disabled={submitting || !newComment.trim() || !newCommentAuthor.trim()}
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
                            {(comment.author_name || comment.author?.full_name || 'U').charAt(0)}
                          </div>
                          <div className="ml-2">
                            <p className="font-semibold text-sm text-gray-900">
                              {comment.author_name || comment.author?.full_name || '名前未設定'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(comment.created_at)}
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
