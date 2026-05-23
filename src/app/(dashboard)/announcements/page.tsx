'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'
import RichTextEditor from '@/components/RichTextEditor'
import Link from 'next/link'
import Image from 'next/image'
import { UserPlus, UserCheck, Pin, Clock, X, Pencil, Trash2, Megaphone, Users, Plus, ArrowRight, Sparkles } from 'lucide-react'
import Avatar from '@/components/Avatar'

// ── photo pool for announcements ─────────────────────────────────────────────
const EVENT_PHOTOS = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&auto=format&fit=crop&q=75',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&auto=format&fit=crop&q=75',
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&auto=format&fit=crop&q=75',
  'https://images.unsplash.com/photo-1543269664-56d93c1b41a6?w=600&auto=format&fit=crop&q=75',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=75',
]
const getPhoto = (id: string) => EVENT_PHOTOS[Math.abs(id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % EVENT_PHOTOS.length]

// ── localStorage helpers ──────────────────────────────────────────────────────
const ANON_ANNOUNCEMENT_LIKES_KEY = 'anon_announcement_likes'
const getAnonLikes = (): string[] => {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(ANON_ANNOUNCEMENT_LIKES_KEY) || '[]') } catch { return [] }
}
const addAnonLike = (id: string) => {
  const likes = getAnonLikes()
  if (!likes.includes(id)) { likes.push(id); localStorage.setItem(ANON_ANNOUNCEMENT_LIKES_KEY, JSON.stringify(likes)) }
}

interface LikeUser {
  id: string; full_name: string; email: string; avatar_url?: string | null; created_at: string; participant_name?: string; participant_email?: string
}
interface Announcement {
  id: string; user_id: string; title: string; content: string; is_pinned: boolean; max_participants: number | null; created_at: string; updated_at: string; author: Profile; likes_count: number; user_has_liked: boolean; liked_users: LikeUser[]
}

export default function AnnouncementsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newIsPinned, setNewIsPinned] = useState(false)
  const [newMaxParticipants, setNewMaxParticipants] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [showLikesModal, setShowLikesModal] = useState<Announcement | null>(null)
  const [anonLikedAnnouncements, setAnonLikedAnnouncements] = useState<string[]>([])
  const [showJoinModal, setShowJoinModal] = useState<string | null>(null)
  const [joinName, setJoinName] = useState('')
  const [joinEmail, setJoinEmail] = useState('')
  const [showDetailModal, setShowDetailModal] = useState<Announcement | null>(null)

  const supabase = createClient()

  useEffect(() => {
    setAnonLikedAnnouncements(getAnonLikes())
    loadData()
  }, [])

  useEffect(() => {
    const announcementsChannel = supabase.channel('announcements-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => { loadAnnouncements() }).subscribe()
    const likesChannel = supabase.channel('announcement-likes-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_likes' }, () => { loadAnnouncements() }).subscribe()
    return () => { supabase.removeChannel(announcementsChannel); supabase.removeChannel(likesChannel) }
  }, [profile])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(profileData)
      }
      await loadAnnouncements()
    } catch (error) { console.error('Error loading data:', error) }
    finally { setLoading(false) }
  }

  const loadAnnouncements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('announcements').select(`*, author:user_id(*), announcement_likes(id, user_id, created_at, participant_name, participant_email, user:user_id(id, full_name, email, avatar_url))`).order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
      if (data) {
        const anonLikes = getAnonLikes()
        const formatted: Announcement[] = data.map((item: any) => ({
          ...item,
          author: Array.isArray(item.author) ? item.author[0] : item.author,
          likes_count: item.announcement_likes?.length || 0,
          user_has_liked: user ? item.announcement_likes?.some((like: any) => like.user_id === user.id) : anonLikes.includes(item.id),
          liked_users: item.announcement_likes?.map((like: any) => {
            const likeUser = Array.isArray(like.user) ? like.user[0] : like.user
            return { id: likeUser?.id || '', full_name: like.participant_name || likeUser?.full_name || '名前未設定', email: like.participant_email || likeUser?.email || '', avatar_url: likeUser?.avatar_url || null, created_at: like.created_at, participant_name: like.participant_name || null, participant_email: like.participant_email || null }
          }) || [],
        }))
        setAnnouncements(formatted)
      }
    } catch (error) { console.error('Error loading announcements:', error) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !newTitle.trim() || !newContent.trim()) return
    setSubmitting(true)
    try {
      const parsedMax = newMaxParticipants.trim() === '' ? null : parseInt(newMaxParticipants, 10)
      if (parsedMax !== null && (!Number.isFinite(parsedMax) || parsedMax <= 0)) { alert('人数制限は1以上の整数を入力してください'); setSubmitting(false); return }
      const { error } = await supabase.from('announcements').insert({ user_id: profile.id, title: newTitle.trim(), content: newContent.trim(), is_pinned: newIsPinned, max_participants: parsedMax })
      if (error) throw error
      setNewTitle(''); setNewContent(''); setNewIsPinned(false); setNewMaxParticipants(''); setShowNewModal(false)
    } catch (error) { console.error('Error creating announcement:', error); alert('告知の作成に失敗しました') }
    finally { setSubmitting(false) }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAnnouncement || !newTitle.trim() || !newContent.trim()) return
    setSubmitting(true)
    try {
      const parsedMax = newMaxParticipants.trim() === '' ? null : parseInt(newMaxParticipants, 10)
      if (parsedMax !== null && (!Number.isFinite(parsedMax) || parsedMax <= 0)) { alert('人数制限は1以上の整数を入力してください'); setSubmitting(false); return }
      if (parsedMax !== null && parsedMax < editingAnnouncement.likes_count) { alert(`現在の参加者数 (${editingAnnouncement.likes_count}人) より小さい値は設定できません`); setSubmitting(false); return }
      const { error } = await supabase.from('announcements').update({ title: newTitle.trim(), content: newContent.trim(), is_pinned: newIsPinned, max_participants: parsedMax, updated_at: new Date().toISOString() }).eq('id', editingAnnouncement.id)
      if (error) throw error
      setNewTitle(''); setNewContent(''); setNewIsPinned(false); setNewMaxParticipants(''); setEditingAnnouncement(null)
    } catch (error) { console.error('Error updating announcement:', error); alert('告知の更新に失敗しました') }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この告知を削除してもよろしいですか？')) return
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id)
      if (error) throw error
    } catch (error) { console.error('Error deleting announcement:', error); alert('告知の削除に失敗しました') }
  }

  const openEditModal = (announcement: Announcement) => {
    setNewTitle(announcement.title); setNewContent(announcement.content); setNewIsPinned(announcement.is_pinned)
    setNewMaxParticipants(announcement.max_participants !== null && announcement.max_participants !== undefined ? String(announcement.max_participants) : '')
    setEditingAnnouncement(announcement)
  }

  const closeModal = () => {
    setNewTitle(''); setNewContent(''); setNewIsPinned(false); setNewMaxParticipants(''); setShowNewModal(false); setEditingAnnouncement(null)
  }

  const isFull = (a: Announcement) => a.max_participants !== null && a.max_participants !== undefined && a.likes_count >= a.max_participants

  const handleJoinClick = (announcement: Announcement) => {
    const hasLiked = announcement.user_has_liked
    if (!hasLiked && isFull(announcement)) return
    if (profile) { handleJoin(announcement.id, hasLiked) }
    else { if (hasLiked) return; setShowJoinModal(announcement.id); setJoinName(''); setJoinEmail('') }
  }

  const handleJoin = async (announcementId: string, hasLiked: boolean) => {
    try {
      if (profile) {
        if (hasLiked) { const { error } = await supabase.from('announcement_likes').delete().eq('announcement_id', announcementId).eq('user_id', profile.id); if (error) throw error }
        else { const { error } = await supabase.from('announcement_likes').insert({ announcement_id: announcementId, user_id: profile.id, participant_name: profile.full_name }); if (error) throw error }
      }
      await loadAnnouncements()
    } catch (error: any) {
      console.error('Error toggling join:', error)
      if (error?.message?.includes('announcement_full')) { alert('このイベントは満員になりました'); await loadAnnouncements() }
    }
  }

  const handleAnonJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showJoinModal || !joinName.trim()) return
    try {
      const { error } = await supabase.from('announcement_likes').insert({ announcement_id: showJoinModal, user_id: null, participant_name: joinName.trim(), participant_email: joinEmail.trim() || null })
      if (error) throw error
      addAnonLike(showJoinModal); setAnonLikedAnnouncements([...anonLikedAnnouncements, showJoinModal]); setShowJoinModal(null); setJoinName(''); setJoinEmail('')
      await loadAnnouncements()
    } catch (error: any) {
      console.error('Error joining:', error)
      if (error?.message?.includes('announcement_full')) { alert('このイベントは満員になりました'); await loadAnnouncements() }
      else { alert('参加登録に失敗しました') }
    }
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

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

  const inputClass = "w-full px-4 py-2.5 rounded-xl text-slate-800 placeholder-slate-400 text-sm border border-slate-200 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="w-5 h-5 text-indigo-500" />
            <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>全体告知</h1>
          </div>
          <p className="text-slate-500 text-sm">運営からのお知らせをお届けします</p>
        </div>
        {profile?.is_admin && (
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
          >
            <Plus className="w-4 h-4" />
            新しい告知
          </button>
        )}
      </div>

      {/* Sign-up CTA for anonymous visitors */}
      {!profile && (
        <div
          className="relative overflow-hidden rounded-2xl p-5 md:p-6 mb-6 flex flex-col md:flex-row md:items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, #0B1629 0%, #1E1B4B 100%)',
            border: '1px solid rgba(99,102,241,0.25)',
          }}
        >
          {/* Decorative orb */}
          <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: '#FF6B6B' }} />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: '#4F46E5' }} />

          <div className="relative flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-xs font-bold uppercase tracking-widest text-amber-300">参加しよう</span>
            </div>
            <h3 className="text-white font-extrabold text-lg md:text-xl leading-tight" style={{ fontFamily: 'var(--font-syne)' }}>
              イベントに参加するには登録が必要です
            </h3>
            <p className="text-slate-300 text-sm mt-1">トロントの言語交換コミュニティに今すぐ参加。</p>
          </div>
          <div className="relative flex items-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:bg-white/10 border border-white/20"
            >
              ログイン
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.03]"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', boxShadow: '0 0 24px rgba(99,102,241,0.4)' }}
            >
              新規登録
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Announcement cards */}
      <div className="space-y-5">
        {announcements.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <Megaphone className="w-12 h-12 mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500">まだ告知がありません。</p>
          </div>
        ) : (
          announcements.map((announcement) => {
            const full = isFull(announcement)
            const disabled = full && !announcement.user_has_liked
            const cap = announcement.max_participants
            const photo = getPhoto(announcement.id)

            return (
              <div
                key={announcement.id}
                onClick={() => setShowDetailModal(announcement)}
                className="group bg-white rounded-2xl border border-slate-100 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl hover:border-slate-200 hover:-translate-y-0.5"
                style={announcement.is_pinned ? { borderLeft: '3px solid #F59E0B' } : {}}
              >
                <div className="flex flex-col md:flex-row">
                  {/* Photo panel */}
                  <div className="relative w-full md:w-52 h-44 md:h-auto flex-shrink-0 overflow-hidden">
                    <Image
                      src={photo}
                      alt={announcement.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, transparent 60%, rgba(255,255,255,0.1))' }} />
                    {announcement.is_pinned && (
                      <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(245,158,11,0.9)', color: 'white' }}>
                        <Pin className="w-3 h-3" />
                        固定
                      </div>
                    )}
                    {/* Participant count overlay */}
                    {cap !== null && cap !== undefined && (
                      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(11,22,41,0.75)', color: 'white', backdropFilter: 'blur(8px)' }}>
                        <Users className="w-3 h-3" />
                        {announcement.likes_count} / {cap}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 mb-1 leading-snug" style={{ fontFamily: 'var(--font-syne)' }}>{announcement.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Avatar
                            url={announcement.author?.avatar_url}
                            name={announcement.author?.full_name}
                            className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs"
                          />
                          <span className="font-medium text-slate-500">{announcement.author?.full_name || '名前未設定'}</span>
                          <span>·</span>
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(announcement.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="text-slate-500 text-sm mb-5 line-clamp-2 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: announcement.content }}
                    />

                    {/* Actions row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleJoinClick(announcement) }}
                        disabled={disabled}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          disabled
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : announcement.user_has_liked
                            ? 'text-white shadow-sm'
                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        }`}
                        style={announcement.user_has_liked && !disabled ? { background: 'linear-gradient(135deg, #4F46E5, #6366F1)' } : {}}
                      >
                        {announcement.user_has_liked ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                        {announcement.user_has_liked ? '参加済み' : full ? '満員' : '参加する'}
                        {cap === null || cap === undefined ? (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-white/20">{announcement.likes_count}</span>
                        ) : null}
                      </button>

                      {profile?.is_admin && announcement.likes_count > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowLikesModal(announcement) }}
                          className="text-indigo-500 hover:text-indigo-700 text-xs font-semibold underline"
                        >
                          参加者一覧
                        </button>
                      )}

                      {profile?.is_admin && (
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditModal(announcement) }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            編集
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(announcement.id) }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            削除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Detail Modal ── */}
      {showDetailModal && (() => {
        const detail = announcements.find((a) => a.id === showDetailModal.id) || showDetailModal
        const full = isFull(detail)
        const disabled = full && !detail.user_has_liked
        const cap = detail.max_participants
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowDetailModal(null)}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Photo header */}
              <div className="relative h-48 flex-shrink-0">
                <Image src={getPhoto(detail.id)} alt={detail.title} fill className="object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(11,22,41,0.8) 0%, rgba(11,22,41,0.2) 60%, transparent 100%)' }} />
                <button onClick={() => setShowDetailModal(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
                  <X className="w-4 h-4 text-white" />
                </button>
                <div className="absolute bottom-4 left-6 right-6">
                  <h2 className="text-xl font-extrabold text-white" style={{ fontFamily: 'var(--font-syne)' }}>{detail.title}</h2>
                  <div className="flex items-center gap-2 text-xs text-slate-300 mt-1">
                    <span>{detail.author?.full_name || '名前未設定'}</span>
                    <span>·</span>
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(detail.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="text-slate-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: detail.content }} />
              </div>

              <div className="p-5 border-t border-slate-100 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => handleJoinClick(detail)}
                  disabled={disabled}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : detail.user_has_liked ? 'text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                  style={detail.user_has_liked && !disabled ? { background: 'linear-gradient(135deg, #4F46E5, #6366F1)' } : {}}
                >
                  {detail.user_has_liked ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {detail.user_has_liked ? '参加済み' : full ? '満員' : '参加する'}
                  {cap !== null && cap !== undefined && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-white/20">{detail.likes_count} / {cap}</span>
                  )}
                </button>
                <button onClick={() => setShowDetailModal(null)} className="ml-auto px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Likes Modal (Admin) ── */}
      {showLikesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>参加者一覧</h2>
                <p className="text-sm text-slate-500 mt-0.5">{showLikesModal.likes_count}人 · {showLikesModal.title}</p>
              </div>
              <button onClick={() => setShowLikesModal(null)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {showLikesModal.liked_users.length === 0 ? (
                <p className="text-slate-500 text-center py-8">参加者はいません</p>
              ) : (
                <div className="space-y-2">
                  {showLikesModal.liked_users.map((user, index) => {
                    const isAnon = !user.id && user.participant_name
                    return (
                      <div key={user.id || `anon-${index}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                        <div className="flex items-center gap-3">
                          <Avatar url={!isAnon ? user.avatar_url : null} name={user.full_name} className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${isAnon ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-600'}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800">{user.full_name}</p>
                              {isAnon && <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">ゲスト</span>}
                            </div>
                            <p className="text-xs text-slate-400">{user.email || '—'}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400">{formatDate(user.created_at)}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100">
              <button onClick={() => setShowLikesModal(null)} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Anon Join Modal ── */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>参加登録</h2>
                <p className="text-sm text-slate-500 mt-1">参加するにはお名前を入力してください。<Link href="/login" className="text-indigo-500 hover:underline ml-1">ログインはこちら</Link></p>
              </div>
              <button onClick={() => { setShowJoinModal(null); setJoinName(''); setJoinEmail('') }} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <form onSubmit={handleAnonJoin} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">お名前 <span className="text-red-500">*</span></label>
                <input type="text" value={joinName} onChange={(e) => setJoinName(e.target.value)} required className={inputClass} placeholder="お名前を入力" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">メールアドレス <span className="text-slate-400 text-xs">（任意）</span></label>
                <input type="email" value={joinEmail} onChange={(e) => setJoinEmail(e.target.value)} className={inputClass} placeholder="example@email.com" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowJoinModal(null); setJoinName(''); setJoinEmail('') }} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">キャンセル</button>
                <button type="submit" disabled={!joinName.trim()} className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>参加する</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── New/Edit Modal ── */}
      {(showNewModal || editingAnnouncement) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>{editingAnnouncement ? '告知を編集' : '新しい告知'}</h2>
              <button onClick={closeModal} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"><X className="w-4 h-4 text-slate-600" /></button>
            </div>
            <form onSubmit={editingAnnouncement ? handleUpdate : handleCreate} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">タイトル</label>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required className={inputClass} placeholder="告知のタイトル" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">内容</label>
                <RichTextEditor content={newContent} onChange={setNewContent} placeholder="告知の内容を入力してください" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">人数制限 <span className="text-slate-400 text-xs">（空欄なら無制限）</span></label>
                <input type="number" min={1} step={1} value={newMaxParticipants} onChange={(e) => setNewMaxParticipants(e.target.value)} className={inputClass} placeholder="例: 10" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newIsPinned} onChange={(e) => setNewIsPinned(e.target.checked)} className="w-4 h-4 rounded text-indigo-600" />
                <span className="text-sm text-slate-700">この告知を固定表示する</span>
              </label>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">キャンセル</button>
                <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
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
