'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'
import { Heart, MessageCircle, Clock, X, BookOpen, Plus, Send } from 'lucide-react'
import Avatar from '@/components/Avatar'

interface Post {
  id: string; user_id: string; title: string; content: string; author_name: string | null; created_at: string; updated_at: string; author: Profile; likes_count: number; comments_count: number; user_has_liked: boolean
}
interface Comment {
  id: string; post_id: string; user_id: string; content: string; author_name: string | null; created_at: string; author: Profile
}

const ANON_LIKES_KEY = 'anon_post_likes'
const getAnonLikes = (): string[] => {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(ANON_LIKES_KEY) || '[]') } catch { return [] }
}
const addAnonLike = (postId: string) => {
  const likes = getAnonLikes()
  if (!likes.includes(postId)) { likes.push(postId); localStorage.setItem(ANON_LIKES_KEY, JSON.stringify(likes)) }
}

// pastel accent per post index
const ACCENTS = [
  'from-indigo-400 to-violet-500',
  'from-rose-400 to-pink-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-500',
]

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

  useEffect(() => { setAnonLikedPosts(getAnonLikes()); loadData() }, [])

  useEffect(() => {
    const postsChannel = supabase.channel('posts-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => { loadPosts() }).subscribe()
    const likesChannel = supabase.channel('likes-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, () => { loadPosts() }).subscribe()
    return () => { supabase.removeChannel(postsChannel); supabase.removeChannel(likesChannel) }
  }, [profile])

  useEffect(() => {
    if (selectedPost) {
      loadComments(selectedPost.id)
      const commentsChannel = supabase.channel(`comments-${selectedPost.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${selectedPost.id}` }, () => { loadComments(selectedPost.id) }).subscribe()
      return () => { supabase.removeChannel(commentsChannel) }
    }
  }, [selectedPost])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(profileData)
      }
      await loadPosts()
    } catch (error) { console.error('Error loading data:', error) }
    finally { setLoading(false) }
  }

  const loadPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: postsData } = await supabase.from('posts').select(`*, author:user_id(*)`).order('created_at', { ascending: false })
      if (postsData) {
        const postsWithCounts = await Promise.all(postsData.map(async (post: any) => {
          const { count: likesCount } = await supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id)
          const { count: commentsCount } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id)
          let userHasLiked = false
          if (user) {
            const { data: userLike } = await supabase.from('post_likes').select('id').eq('post_id', post.id).eq('user_id', user.id).single()
            userHasLiked = !!userLike
          } else {
            userHasLiked = getAnonLikes().includes(post.id)
          }
          return { ...post, author: Array.isArray(post.author) ? post.author[0] : post.author, likes_count: likesCount || 0, comments_count: commentsCount || 0, user_has_liked: userHasLiked }
        }))
        setPosts(postsWithCounts)
      }
    } catch (error) { console.error('Error loading posts:', error) }
  }

  const loadComments = async (postId: string) => {
    try {
      const { data } = await supabase.from('comments').select(`*, author:user_id(*)`).eq('post_id', postId).order('created_at', { ascending: true })
      if (data) {
        setComments(data.map((c: any) => ({ ...c, author: Array.isArray(c.author) ? c.author[0] : c.author })))
      }
    } catch (error) { console.error('Error loading comments:', error) }
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPostTitle.trim() || !newPostContent.trim() || !newPostAuthor.trim()) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('posts').insert({ user_id: profile?.id || null, title: newPostTitle.trim(), content: newPostContent.trim(), author_name: newPostAuthor.trim() })
      if (error) throw error
      setNewPostTitle(''); setNewPostContent(''); setNewPostAuthor(''); setShowNewPostModal(false)
    } catch (error) { console.error('Error creating post:', error); alert('投稿の作成に失敗しました') }
    finally { setSubmitting(false) }
  }

  const handleLikeToggle = async (post: Post) => {
    try {
      if (profile) {
        if (post.user_has_liked) {
          const { error } = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', profile.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: profile.id })
          if (error) throw error
        }
      } else {
        if (anonLikedPosts.includes(post.id)) return
        const { error } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: null })
        if (error) throw error
        addAnonLike(post.id); setAnonLikedPosts([...anonLikedPosts, post.id])
      }
      await loadPosts()
    } catch (error) { console.error('Error toggling like:', error) }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPost || !newComment.trim() || !newCommentAuthor.trim()) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('comments').insert({ post_id: selectedPost.id, user_id: profile?.id || null, content: newComment.trim(), author_name: newCommentAuthor.trim() })
      if (error) throw error
      setNewComment(''); setNewCommentAuthor('')
    } catch (error) { console.error('Error adding comment:', error); alert('コメントの投稿に失敗しました') }
    finally { setSubmitting(false) }
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const inputClass = "w-full px-4 py-2.5 rounded-xl text-slate-800 placeholder-slate-400 text-sm border border-slate-200 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>掲示板</h1>
          </div>
          <p className="text-slate-500 text-sm">みんなで情報をシェアしましょう</p>
        </div>
        <button
          onClick={() => setShowNewPostModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
        >
          <Plus className="w-4 h-4" />
          投稿する
        </button>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 mb-3">まだ投稿がありません。最初の投稿をしてみましょう！</p>
            <button onClick={() => setShowNewPostModal(true)} className="px-6 py-2 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>投稿する</button>
          </div>
        ) : (
          posts.map((post, idx) => {
            const accentClass = ACCENTS[idx % ACCENTS.length]
            const authorDisplay = post.author_name || post.author?.full_name || '名前未設定'
            const initials = authorDisplay.charAt(0)

            return (
              <div
                key={post.id}
                className="group bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all duration-200 hover:shadow-xl hover:border-slate-200 hover:-translate-y-0.5"
              >
                <div className="flex flex-col md:flex-row">
                  {/* Color accent panel */}
                  <div className={`relative w-full md:w-16 h-2 md:h-auto flex-shrink-0 bg-gradient-to-br ${accentClass}`}>
                    {/* Author initial on desktop */}
                    <div className="hidden md:flex absolute inset-0 items-center justify-center">
                      <span className="text-white font-extrabold text-xl opacity-40" style={{ fontFamily: 'var(--font-syne)' }}>
                        {initials}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-5">
                    <div className="mb-3">
                      <h3 className="text-base font-bold text-slate-900 mb-1 leading-snug" style={{ fontFamily: 'var(--font-syne)' }}>{post.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Avatar
                          url={post.author_name ? null : post.author?.avatar_url}
                          name={authorDisplay}
                          className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs"
                        />
                        <span className="font-medium text-slate-500">{authorDisplay}</span>
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                    </div>

                    <p className="text-slate-500 text-sm mb-4 line-clamp-2 leading-relaxed">{post.content}</p>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleLikeToggle(post)}
                        className={`group/like flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                          post.user_has_liked
                            ? 'bg-red-50 text-red-500'
                            : 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-400'
                        }`}
                      >
                        <Heart className={`w-4 h-4 transition-transform group-hover/like:scale-110 ${post.user_has_liked ? 'fill-current' : ''}`} />
                        <span>{post.likes_count}</span>
                      </button>
                      <button
                        onClick={() => setSelectedPost(post)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-500 transition-all"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{post.comments_count}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── New Post Modal ── */}
      {showNewPostModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>新しい投稿</h2>
              <button onClick={() => setShowNewPostModal(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"><X className="w-4 h-4 text-slate-600" /></button>
            </div>
            <form onSubmit={handleCreatePost} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">お名前</label>
                <input type="text" value={newPostAuthor} onChange={(e) => setNewPostAuthor(e.target.value)} required className={inputClass} placeholder="表示される名前" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">タイトル</label>
                <input type="text" value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} required className={inputClass} placeholder="投稿のタイトル" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">内容</label>
                <textarea value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} required rows={6} className={`${inputClass} resize-none`} placeholder="シェアしたいことを書いてください" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowNewPostModal(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">キャンセル</button>
                <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                  {submitting ? '投稿中...' : '投稿する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Post Detail Modal ── */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-start gap-3 flex-shrink-0">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 leading-snug" style={{ fontFamily: 'var(--font-syne)' }}>{selectedPost.title}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1.5">
                  <Avatar
                    url={selectedPost.author_name ? null : selectedPost.author?.avatar_url}
                    name={selectedPost.author_name || selectedPost.author?.full_name}
                    className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs"
                  />
                  <span className="font-medium text-slate-500">{selectedPost.author_name || selectedPost.author?.full_name || '名前未設定'}</span>
                  <span>·</span>
                  <span>{formatDate(selectedPost.created_at)}</span>
                </div>
              </div>
              <button onClick={() => setSelectedPost(null)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Post body */}
              <div className="p-6 border-b border-slate-50">
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedPost.content}</p>
              </div>

              {/* Comments */}
              <div className="p-6">
                <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2 text-sm">
                  <MessageCircle className="w-4 h-4 text-indigo-500" />
                  コメント ({comments.length})
                </h3>

                {/* Comment form */}
                <form onSubmit={handleAddComment} className="mb-6 p-4 rounded-2xl border border-slate-100 bg-slate-50 space-y-2.5">
                  <input
                    type="text"
                    value={newCommentAuthor}
                    onChange={(e) => setNewCommentAuthor(e.target.value)}
                    placeholder="お名前"
                    className={inputClass}
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="コメントを入力..."
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="submit"
                      disabled={submitting || !newComment.trim() || !newCommentAuthor.trim()}
                      className="px-4 py-2.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
                    >
                      <Send className="w-3.5 h-3.5" />
                      送信
                    </button>
                  </div>
                </form>

                {/* Comments list */}
                <div className="space-y-3">
                  {comments.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-4">まだコメントがありません</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar
                          url={comment.author_name ? null : comment.author?.avatar_url}
                          name={comment.author_name || comment.author?.full_name}
                          className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0"
                        />
                        <div className="flex-1 bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold text-slate-800">{comment.author_name || comment.author?.full_name || '名前未設定'}</p>
                            <p className="text-xs text-slate-400">{formatDate(comment.created_at)}</p>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">{comment.content}</p>
                        </div>
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
