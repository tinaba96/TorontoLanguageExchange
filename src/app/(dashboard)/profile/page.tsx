'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, StudentProfile, TeacherProfile } from '@/lib/types/database.types'
import { Pencil, X, Check, Camera, Trash2, User, MapPin, Clock, Star, BookOpen } from 'lucide-react'
import Avatar from '@/components/Avatar'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 2 * 1024 * 1024

type StudentForm = {
  bio: string; learning_goals: string; desired_teacher_type: string
  japanese_level: 'beginner' | 'intermediate' | 'advanced'; availability: string; location: string
}
type TeacherForm = {
  bio: string; teaching_experience: string; specialties: string; location: string; hourly_rate: string
}

const emptyStudentForm: StudentForm = { bio: '', learning_goals: '', desired_teacher_type: '', japanese_level: 'beginner', availability: '', location: '' }
const emptyTeacherForm: TeacherForm = { bio: '', teaching_experience: '', specialties: '', location: '', hourly_rate: '' }

const inputClass = "w-full px-4 py-2.5 rounded-xl text-slate-800 placeholder-slate-400 text-sm border border-slate-200 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
const textareaClass = `${inputClass} resize-none`
const fieldBg = "text-slate-700 bg-slate-50 px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">{children}</label>
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [studentForm, setStudentForm] = useState<StudentForm>(emptyStudentForm)
  const [teacherForm, setTeacherForm] = useState<TeacherForm>(emptyTeacherForm)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const [profileResult, versionResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('app_settings').select('value').eq('key', 'passphrase_version').single(),
      ])
      const profileData = profileResult.data as Profile | null
      const userVersion = profileData?.passphrase_version || 0
      const currentVersion = parseInt(versionResult.data?.value || '1', 10)
      if (!profileData?.is_admin && userVersion < currentVersion) { router.push('/verify-passphrase'); return }
      if (!profileData) { router.push('/'); return }
      setProfile(profileData)
      if (profileData.role === 'student') {
        const { data } = await supabase.from('student_profiles').select('*').eq('user_id', user.id).single()
        if (data) {
          const sp = data as StudentProfile
          setStudentProfile(sp)
          setStudentForm({ bio: sp.bio || '', learning_goals: sp.learning_goals || '', desired_teacher_type: sp.desired_teacher_type || '', japanese_level: sp.japanese_level || 'beginner', availability: sp.availability || '', location: sp.location || '' })
        }
      } else if (profileData.role === 'teacher') {
        const { data } = await supabase.from('teacher_profiles').select('*').eq('user_id', user.id).single()
        if (data) {
          const tp = data as TeacherProfile
          setTeacherProfile(tp)
          setTeacherForm({ bio: tp.bio || '', teaching_experience: tp.teaching_experience || '', specialties: (tp.specialties || []).join(', '), location: tp.location || '', hourly_rate: tp.hourly_rate !== null && tp.hourly_rate !== undefined ? String(tp.hourly_rate) : '' })
        }
      }
    } catch (error) { console.error('Error loading profile:', error) }
    finally { setLoading(false) }
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    try {
      if (profile.role === 'student') {
        const { error } = await supabase.from('student_profiles').update(studentForm).eq('user_id', profile.id)
        if (error) throw error
      } else if (profile.role === 'teacher') {
        const rate = teacherForm.hourly_rate.trim() === '' ? null : Number(teacherForm.hourly_rate)
        if (rate !== null && (!Number.isFinite(rate) || rate < 0)) { alert('時給は0以上の数値で入力してください'); setSaving(false); return }
        const specialties = teacherForm.specialties.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        const { error } = await supabase.from('teacher_profiles').update({ bio: teacherForm.bio, teaching_experience: teacherForm.teaching_experience, specialties, location: teacherForm.location, hourly_rate: rate }).eq('user_id', profile.id)
        if (error) throw error
      }
      await loadProfile()
      setEditing(false)
    } catch (error) { console.error('Error saving profile:', error); alert('プロフィールの保存に失敗しました') }
    finally { setSaving(false) }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !profile) return
    if (!ACCEPTED_TYPES.includes(file.type)) { alert('対応形式は JPEG / PNG / WebP です'); return }
    if (file.size > MAX_SIZE_BYTES) { alert('ファイルサイズは2MB以下にしてください'); return }
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const folder = profile.id
      const filePath = `${folder}/avatar-${Date.now()}.${ext}`
      const { data: existing } = await supabase.storage.from('avatars').list(folder)
      if (existing && existing.length > 0) { await supabase.storage.from('avatars').remove(existing.map((f) => `${folder}/${f.name}`)) }
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { contentType: file.type, upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id)
      if (updateError) throw updateError
      await loadProfile()
    } catch (error) { console.error('Error uploading avatar:', error); alert('画像のアップロードに失敗しました') }
    finally { setUploadingAvatar(false) }
  }

  const handleAvatarDelete = async () => {
    if (!profile?.avatar_url) return
    if (!confirm('プロフィール画像を削除してもよろしいですか？')) return
    setUploadingAvatar(true)
    try {
      const folder = profile.id
      const { data: existing } = await supabase.storage.from('avatars').list(folder)
      if (existing && existing.length > 0) { await supabase.storage.from('avatars').remove(existing.map((f) => `${folder}/${f.name}`)) }
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id)
      if (updateError) throw updateError
      await loadProfile()
    } catch (error) { console.error('Error deleting avatar:', error); alert('画像の削除に失敗しました') }
    finally { setUploadingAvatar(false) }
  }

  const cancelEdit = () => {
    setEditing(false)
    if (profile?.role === 'student' && studentProfile) {
      setStudentForm({ bio: studentProfile.bio || '', learning_goals: studentProfile.learning_goals || '', desired_teacher_type: studentProfile.desired_teacher_type || '', japanese_level: studentProfile.japanese_level || 'beginner', availability: studentProfile.availability || '', location: studentProfile.location || '' })
    } else if (profile?.role === 'teacher' && teacherProfile) {
      setTeacherForm({ bio: teacherProfile.bio || '', teaching_experience: teacherProfile.teaching_experience || '', specialties: (teacherProfile.specialties || []).join(', '), location: teacherProfile.location || '', hourly_rate: teacherProfile.hourly_rate !== null && teacherProfile.hourly_rate !== undefined ? String(teacherProfile.hourly_rate) : '' })
    }
  }

  const getLevelLabel = (level: string | null) => ({ beginner: '初級', intermediate: '中級', advanced: '上級' }[level as 'beginner' | 'intermediate' | 'advanced'] || '未設定')

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

  const isTeacher = profile?.role === 'teacher'
  const roleLabel = isTeacher ? 'Japanese Teacher' : 'English Speaker'

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-2 mb-6">
        <User className="w-5 h-5 text-indigo-500" />
        <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>プロフィール</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Hero banner */}
        <div className="relative h-28" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)' }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          {/* Edit / Save buttons */}
          <div className="absolute top-4 right-4 flex gap-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:bg-white/20"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
              >
                <Pencil className="w-3.5 h-3.5" />
                編集する
              </button>
            ) : (
              <>
                <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                  <X className="w-3.5 h-3.5" />
                  キャンセル
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-indigo-600 bg-white hover:bg-indigo-50 transition-colors disabled:opacity-50">
                  <Check className="w-3.5 h-3.5" />
                  {saving ? '保存中...' : '保存'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Avatar + name */}
        <div className="px-8 pb-6">
          <div className="flex items-end gap-5 -mt-10 mb-6">
            {/* Avatar */}
            <div className="relative group flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl border-3 border-white" style={{ border: '3px solid white' }}>
                <Avatar
                  url={profile?.avatar_url}
                  name={profile?.full_name}
                  fallback="U"
                  className="w-20 h-20 flex items-center justify-center font-extrabold text-2xl text-white overflow-hidden"
                  imgClassName="w-full h-full object-cover"
                />
                {!profile?.avatar_url && (
                  <div className="absolute inset-0 flex items-center justify-center font-extrabold text-2xl text-white" style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                    {profile?.full_name?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                aria-label="画像を変更"
              >
                {uploadingAvatar ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Camera className="w-5 h-5" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
            </div>

            {/* Name & role */}
            <div className="pb-1">
              <h2 className="text-xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>{profile?.full_name || '名前未設定'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>{roleLabel}</span>
                {profile?.avatar_url && (
                  <button type="button" onClick={handleAvatarDelete} disabled={uploadingAvatar} className="text-xs text-slate-400 hover:text-red-500 underline flex items-center gap-1 disabled:opacity-50 transition-colors">
                    <Trash2 className="w-3 h-3" />削除
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">{profile?.email}</p>
            </div>
          </div>

          {/* Fields */}
          {profile?.role === 'student' && (
            <div className="space-y-5">
              <div>
                <FieldLabel>自己紹介</FieldLabel>
                {editing ? <textarea value={studentForm.bio} onChange={(e) => setStudentForm({ ...studentForm, bio: e.target.value })} rows={4} className={textareaClass} placeholder="あなたについて教えてください" /> : <p className={fieldBg}>{studentProfile?.bio || '未設定'}</p>}
              </div>
              <div>
                <FieldLabel>学習目標</FieldLabel>
                {editing ? <textarea value={studentForm.learning_goals} onChange={(e) => setStudentForm({ ...studentForm, learning_goals: e.target.value })} rows={3} className={textareaClass} placeholder="どんな日本語を学びたいですか？" /> : <p className={fieldBg}>{studentProfile?.learning_goals || '未設定'}</p>}
              </div>
              <div>
                <FieldLabel>理想の先生像</FieldLabel>
                {editing ? <textarea value={studentForm.desired_teacher_type} onChange={(e) => setStudentForm({ ...studentForm, desired_teacher_type: e.target.value })} rows={2} className={textareaClass} placeholder="どんな先生に教えてほしいですか？" /> : <p className={fieldBg}>{studentProfile?.desired_teacher_type || '未設定'}</p>}
              </div>
              <div>
                <FieldLabel>日本語レベル</FieldLabel>
                {editing ? (
                  <select value={studentForm.japanese_level} onChange={(e) => setStudentForm({ ...studentForm, japanese_level: e.target.value as StudentForm['japanese_level'] })} className={inputClass}>
                    <option value="beginner">初級</option>
                    <option value="intermediate">中級</option>
                    <option value="advanced">上級</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    <span className="text-slate-700 text-sm font-medium">{getLevelLabel(studentProfile?.japanese_level || null)}</span>
                  </div>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <FieldLabel>対応可能な時間帯</FieldLabel>
                  {editing ? <input type="text" value={studentForm.availability} onChange={(e) => setStudentForm({ ...studentForm, availability: e.target.value })} className={inputClass} placeholder="例: 平日夕方、週末" /> : (
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /><span className="text-slate-600 text-sm">{studentProfile?.availability || '未設定'}</span></div>
                  )}
                </div>
                <div>
                  <FieldLabel>場所</FieldLabel>
                  {editing ? <input type="text" value={studentForm.location} onChange={(e) => setStudentForm({ ...studentForm, location: e.target.value })} className={inputClass} placeholder="例: トロント市内、ダウンタウン" /> : (
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /><span className="text-slate-600 text-sm">{studentProfile?.location || '未設定'}</span></div>
                  )}
                </div>
              </div>
            </div>
          )}

          {profile?.role === 'teacher' && (
            <div className="space-y-5">
              <div>
                <FieldLabel>自己紹介</FieldLabel>
                {editing ? <textarea value={teacherForm.bio} onChange={(e) => setTeacherForm({ ...teacherForm, bio: e.target.value })} rows={4} className={textareaClass} placeholder="あなたについて教えてください" /> : <p className={fieldBg}>{teacherProfile?.bio || '未設定'}</p>}
              </div>
              <div>
                <FieldLabel>指導経験</FieldLabel>
                {editing ? <textarea value={teacherForm.teaching_experience} onChange={(e) => setTeacherForm({ ...teacherForm, teaching_experience: e.target.value })} rows={3} className={textareaClass} placeholder="これまでの指導経験を教えてください" /> : <p className={fieldBg}>{teacherProfile?.teaching_experience || '未設定'}</p>}
              </div>
              <div>
                <FieldLabel>得意分野 <span className="font-normal normal-case tracking-normal">（カンマ区切り）</span></FieldLabel>
                {editing ? (
                  <input type="text" value={teacherForm.specialties} onChange={(e) => setTeacherForm({ ...teacherForm, specialties: e.target.value })} className={inputClass} placeholder="例: ビジネス日本語, 会話, JLPT対策" />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {teacherProfile?.specialties && teacherProfile.specialties.length > 0 ? (
                      teacherProfile.specialties.map((s, i) => (
                        <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(79,70,229,0.08)', color: '#4F46E5' }}>
                          <Star className="w-3 h-3" />{s}
                        </span>
                      ))
                    ) : <p className="text-slate-400 text-sm">未設定</p>}
                  </div>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <FieldLabel>時給 (CAD · 1時間あたりのセント)</FieldLabel>
                  {editing ? (
                    <input type="number" min={0} step={1} value={teacherForm.hourly_rate} onChange={(e) => setTeacherForm({ ...teacherForm, hourly_rate: e.target.value })} className={inputClass} placeholder="例: 3000 (= $30.00 CAD)" />
                  ) : (
                    <p className="text-slate-700 text-sm font-semibold">
                      {teacherProfile?.hourly_rate !== null && teacherProfile?.hourly_rate !== undefined ? `$${(teacherProfile.hourly_rate / 100).toFixed(2)} CAD / 時` : '未設定'}
                    </p>
                  )}
                </div>
                <div>
                  <FieldLabel>場所</FieldLabel>
                  {editing ? <input type="text" value={teacherForm.location} onChange={(e) => setTeacherForm({ ...teacherForm, location: e.target.value })} className={inputClass} placeholder="例: トロント市内、ダウンタウン" /> : (
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /><span className="text-slate-600 text-sm">{teacherProfile?.location || '未設定'}</span></div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
