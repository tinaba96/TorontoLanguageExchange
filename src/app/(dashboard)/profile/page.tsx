'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, StudentProfile, TeacherProfile } from '@/lib/types/database.types'
import { Pencil, X, Check } from 'lucide-react'

type StudentForm = {
  bio: string
  learning_goals: string
  desired_teacher_type: string
  japanese_level: 'beginner' | 'intermediate' | 'advanced'
  availability: string
  location: string
}

type TeacherForm = {
  bio: string
  teaching_experience: string
  specialties: string
  location: string
  hourly_rate: string
}

const emptyStudentForm: StudentForm = {
  bio: '',
  learning_goals: '',
  desired_teacher_type: '',
  japanese_level: 'beginner',
  availability: '',
  location: '',
}

const emptyTeacherForm: TeacherForm = {
  bio: '',
  teaching_experience: '',
  specialties: '',
  location: '',
  hourly_rate: '',
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
        supabase.from('app_settings').select('value').eq('key', 'passphrase_version').single(),
      ])

      const profileData = profileResult.data as Profile | null
      const userVersion = profileData?.passphrase_version || 0
      const currentVersion = parseInt(versionResult.data?.value || '1', 10)

      if (!profileData?.is_admin && userVersion < currentVersion) {
        router.push('/verify-passphrase')
        return
      }

      if (!profileData) {
        router.push('/')
        return
      }

      setProfile(profileData)

      if (profileData.role === 'student') {
        const { data } = await supabase
          .from('student_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
        if (data) {
          const sp = data as StudentProfile
          setStudentProfile(sp)
          setStudentForm({
            bio: sp.bio || '',
            learning_goals: sp.learning_goals || '',
            desired_teacher_type: sp.desired_teacher_type || '',
            japanese_level: sp.japanese_level || 'beginner',
            availability: sp.availability || '',
            location: sp.location || '',
          })
        }
      } else if (profileData.role === 'teacher') {
        const { data } = await supabase
          .from('teacher_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
        if (data) {
          const tp = data as TeacherProfile
          setTeacherProfile(tp)
          setTeacherForm({
            bio: tp.bio || '',
            teaching_experience: tp.teaching_experience || '',
            specialties: (tp.specialties || []).join(', '),
            location: tp.location || '',
            hourly_rate: tp.hourly_rate !== null && tp.hourly_rate !== undefined ? String(tp.hourly_rate) : '',
          })
        }
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
      if (profile.role === 'student') {
        const { error } = await supabase
          .from('student_profiles')
          .update(studentForm)
          .eq('user_id', profile.id)
        if (error) throw error
      } else if (profile.role === 'teacher') {
        const rate = teacherForm.hourly_rate.trim() === '' ? null : Number(teacherForm.hourly_rate)
        if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
          alert('時給は0以上の数値で入力してください')
          setSaving(false)
          return
        }
        const specialties = teacherForm.specialties
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
        const { error } = await supabase
          .from('teacher_profiles')
          .update({
            bio: teacherForm.bio,
            teaching_experience: teacherForm.teaching_experience,
            specialties,
            location: teacherForm.location,
            hourly_rate: rate,
          })
          .eq('user_id', profile.id)
        if (error) throw error
      }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-gray-600">読み込み中...</div>
      </div>
    )
  }

  const roleLabel = profile?.role === 'teacher' ? '先生' : '生徒'

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">プロフィール</h1>
        <p className="text-gray-600 mt-1">あなたのプロフィールを設定しましょう</p>
      </div>

      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-lg">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-bold">{profile?.full_name || '名前未設定'}</h2>
                <p className="text-indigo-100">{profile?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold">
                  {roleLabel}
                </span>
              </div>
            </div>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <Pencil className="w-4 h-4" />
                編集する
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditing(false)
                    if (profile?.role === 'student' && studentProfile) {
                      setStudentForm({
                        bio: studentProfile.bio || '',
                        learning_goals: studentProfile.learning_goals || '',
                        desired_teacher_type: studentProfile.desired_teacher_type || '',
                        japanese_level: studentProfile.japanese_level || 'beginner',
                        availability: studentProfile.availability || '',
                        location: studentProfile.location || '',
                      })
                    } else if (profile?.role === 'teacher' && teacherProfile) {
                      setTeacherForm({
                        bio: teacherProfile.bio || '',
                        teaching_experience: teacherProfile.teaching_experience || '',
                        specialties: (teacherProfile.specialties || []).join(', '),
                        location: teacherProfile.location || '',
                        hourly_rate:
                          teacherProfile.hourly_rate !== null && teacherProfile.hourly_rate !== undefined
                            ? String(teacherProfile.hourly_rate)
                            : '',
                      })
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            )}
          </div>
        </div>

        {profile?.role === 'student' && (
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">自己紹介</label>
              {editing ? (
                <textarea
                  value={studentForm.bio}
                  onChange={(e) => setStudentForm({ ...studentForm, bio: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="あなたについて教えてください"
                />
              ) : (
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                  {studentProfile?.bio || '未設定'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">学習目標</label>
              {editing ? (
                <textarea
                  value={studentForm.learning_goals}
                  onChange={(e) => setStudentForm({ ...studentForm, learning_goals: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="どんな日本語を学びたいですか？"
                />
              ) : (
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                  {studentProfile?.learning_goals || '未設定'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">理想の先生像</label>
              {editing ? (
                <textarea
                  value={studentForm.desired_teacher_type}
                  onChange={(e) => setStudentForm({ ...studentForm, desired_teacher_type: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="どんな先生に教えてほしいですか？"
                />
              ) : (
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                  {studentProfile?.desired_teacher_type || '未設定'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">日本語レベル</label>
              {editing ? (
                <select
                  value={studentForm.japanese_level}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, japanese_level: e.target.value as StudentForm['japanese_level'] })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="beginner">初級</option>
                  <option value="intermediate">中級</option>
                  <option value="advanced">上級</option>
                </select>
              ) : (
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {getLevelLabel(studentProfile?.japanese_level || null)}
                </p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">対応可能な時間帯</label>
                {editing ? (
                  <input
                    type="text"
                    value={studentForm.availability}
                    onChange={(e) => setStudentForm({ ...studentForm, availability: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="例: 平日夕方、週末"
                  />
                ) : (
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{studentProfile?.availability || '未設定'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">場所</label>
                {editing ? (
                  <input
                    type="text"
                    value={studentForm.location}
                    onChange={(e) => setStudentForm({ ...studentForm, location: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="例: トロント市内、ダウンタウン"
                  />
                ) : (
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{studentProfile?.location || '未設定'}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {profile?.role === 'teacher' && (
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">自己紹介</label>
              {editing ? (
                <textarea
                  value={teacherForm.bio}
                  onChange={(e) => setTeacherForm({ ...teacherForm, bio: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="あなたについて教えてください"
                />
              ) : (
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                  {teacherProfile?.bio || '未設定'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">指導経験</label>
              {editing ? (
                <textarea
                  value={teacherForm.teaching_experience}
                  onChange={(e) => setTeacherForm({ ...teacherForm, teaching_experience: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="これまでの指導経験を教えてください"
                />
              ) : (
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                  {teacherProfile?.teaching_experience || '未設定'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                得意分野 <span className="text-gray-400 text-xs">（カンマ区切り）</span>
              </label>
              {editing ? (
                <input
                  type="text"
                  value={teacherForm.specialties}
                  onChange={(e) => setTeacherForm({ ...teacherForm, specialties: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="例: ビジネス日本語, 会話, JLPT対策"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {teacherProfile?.specialties && teacherProfile.specialties.length > 0 ? (
                    teacherProfile.specialties.map((s, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm"
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg w-full">未設定</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  時給 <span className="text-gray-400 text-xs">（CAD）</span>
                </label>
                {editing ? (
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={teacherForm.hourly_rate}
                    onChange={(e) => setTeacherForm({ ...teacherForm, hourly_rate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="例: 30"
                  />
                ) : (
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {teacherProfile?.hourly_rate !== null && teacherProfile?.hourly_rate !== undefined
                      ? `$${teacherProfile.hourly_rate} CAD / 時`
                      : '未設定'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">場所</label>
                {editing ? (
                  <input
                    type="text"
                    value={teacherForm.location}
                    onChange={(e) => setTeacherForm({ ...teacherForm, location: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="例: トロント市内、ダウンタウン"
                  />
                ) : (
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{teacherProfile?.location || '未設定'}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
