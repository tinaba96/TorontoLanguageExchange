'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, StudentProfile } from '@/lib/types/database.types'
import { Pencil, X, Check, BookOpen, Target, Star, MapPin, Clock, User } from 'lucide-react'
import Avatar from '@/components/Avatar'

export default function StudentDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    bio: '',
    learning_goals: '',
    desired_teacher_type: '',
    japanese_level: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    availability: '',
    location: '',
  })

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const [profileResult, versionResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('app_settings').select('value').eq('key', 'passphrase_version').single()
      ])

      const profileData = profileResult.data
      const userVersion = profileData?.passphrase_version || 0
      const currentVersion = parseInt(versionResult.data?.value || '1', 10)

      if (!profileData?.is_admin && userVersion < currentVersion) {
        router.push('/verify-passphrase')
        return
      }

      if ((profileData as any)?.role !== 'student') {
        router.push('/')
        return
      }

      setProfile(profileData)

      const { data: studentData } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (studentData) {
        setStudentProfile(studentData as any)
        const data = studentData as any
        setFormData({
          bio: data.bio || '',
          learning_goals: data.learning_goals || '',
          desired_teacher_type: data.desired_teacher_type || '',
          japanese_level: data.japanese_level || 'beginner',
          availability: data.availability || '',
          location: data.location || '',
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('student_profiles')
        .update(formData)
        .eq('user_id', profile.id)

      if (error) throw error

      await loadProfile()
      setEditing(false)
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('プロフィールの保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const getLevelLabel = (level: string | null) => {
    const levels = { beginner: '初級', intermediate: '中級', advanced: '上級' }
    return levels[level as keyof typeof levels] || '未設定'
  }

  const getLevelConfig = (level: string | null) => {
    const configs = {
      beginner: { label: '初級', bg: 'rgba(16,185,129,0.12)', color: '#059669', border: 'rgba(16,185,129,0.3)' },
      intermediate: { label: '中級', bg: 'rgba(245,158,11,0.12)', color: '#D97706', border: 'rgba(245,158,11,0.3)' },
      advanced: { label: '上級', bg: 'rgba(239,68,68,0.12)', color: '#DC2626', border: 'rgba(239,68,68,0.3)' },
    }
    return configs[level as keyof typeof configs] || { label: '未設定', bg: 'rgba(100,116,139,0.1)', color: '#64748B', border: 'rgba(100,116,139,0.2)' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  const levelConfig = getLevelConfig(studentProfile?.japanese_level || null)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>
            マイプロフィール
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">学習プロフィールを充実させてベストな先生を見つけよう</p>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            編集する
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
            >
              <Check className="w-4 h-4" />
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        )}
      </div>

      {/* Profile hero card */}
      <div className="rounded-3xl overflow-hidden border border-slate-100 shadow-xl">
        {/* Banner */}
        <div
          className="h-28 relative"
          style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1E3A5F 50%, #4F46E5 100%)' }}
        >
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #6366F1 0%, transparent 50%), radial-gradient(circle at 80% 20%, #FF6B6B 0%, transparent 40%)' }}
          />
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
        </div>

        <div className="bg-white px-8 pb-8">
          {/* Avatar overlapping banner */}
          <div className="flex items-end justify-between -mt-10 mb-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl ring-4 ring-white overflow-hidden shadow-lg">
                <Avatar
                  url={profile?.avatar_url}
                  name={profile?.full_name}
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover"
                />
              </div>
            </div>
            {/* Level badge */}
            <div
              className="px-4 py-1.5 rounded-full text-sm font-bold border"
              style={{ background: levelConfig.bg, color: levelConfig.color, borderColor: levelConfig.border }}
            >
              日本語 {levelConfig.label}
            </div>
          </div>

          <h2 className="text-xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>
            {profile?.full_name || '名前未設定'}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">{profile?.email}</p>
        </div>
      </div>

      {/* Fields */}
      <div className="grid gap-4">
        {/* Bio */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(79,70,229,0.1)' }}>
              <User className="w-4 h-4 text-indigo-600" />
            </div>
            <label className="text-sm font-bold text-slate-700">自己紹介</label>
          </div>
          {editing ? (
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              placeholder="あなたについて教えてください"
            />
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-4 py-3 min-h-[60px]">
              {studentProfile?.bio || <span className="text-slate-400 italic">未設定</span>}
            </p>
          )}
        </div>

        {/* Learning goals */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <Target className="w-4 h-4 text-emerald-600" />
            </div>
            <label className="text-sm font-bold text-slate-700">学習目標</label>
          </div>
          {editing ? (
            <textarea
              value={formData.learning_goals}
              onChange={(e) => setFormData({ ...formData, learning_goals: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              placeholder="どんな日本語を学びたいですか？"
            />
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-4 py-3 min-h-[60px]">
              {studentProfile?.learning_goals || <span className="text-slate-400 italic">未設定</span>}
            </p>
          )}
        </div>

        {/* Desired teacher */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <Star className="w-4 h-4 text-amber-500" />
            </div>
            <label className="text-sm font-bold text-slate-700">理想の先生像</label>
          </div>
          {editing ? (
            <textarea
              value={formData.desired_teacher_type}
              onChange={(e) => setFormData({ ...formData, desired_teacher_type: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              placeholder="どんな先生に教えてほしいですか？"
            />
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-4 py-3 min-h-[52px]">
              {studentProfile?.desired_teacher_type || <span className="text-slate-400 italic">未設定</span>}
            </p>
          )}
        </div>

        {/* Level selector (editing only) */}
        {editing && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
                <BookOpen className="w-4 h-4 text-indigo-500" />
              </div>
              <label className="text-sm font-bold text-slate-700">日本語レベル</label>
            </div>
            <div className="flex gap-3">
              {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => {
                const cfg = getLevelConfig(lvl)
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFormData({ ...formData, japanese_level: lvl })}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                    style={
                      formData.japanese_level === lvl
                        ? { background: cfg.bg, color: cfg.color, borderColor: cfg.border }
                        : { background: '#F8FAFC', color: '#94A3B8', borderColor: '#E2E8F0' }
                    }
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Location + Availability */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                <MapPin className="w-4 h-4 text-blue-500" />
              </div>
              <label className="text-sm font-bold text-slate-700">場所</label>
            </div>
            {editing ? (
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                placeholder="例: トロント市内、ダウンタウン"
              />
            ) : (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3">
                {studentProfile?.location || <span className="text-slate-400 italic">未設定</span>}
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.1)' }}>
                <Clock className="w-4 h-4 text-purple-500" />
              </div>
              <label className="text-sm font-bold text-slate-700">対応可能な時間帯</label>
            </div>
            {editing ? (
              <input
                type="text"
                value={formData.availability}
                onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                placeholder="例: 平日夕方、週末"
              />
            ) : (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3">
                {studentProfile?.availability || <span className="text-slate-400 italic">未設定</span>}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
