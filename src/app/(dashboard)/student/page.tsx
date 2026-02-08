'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, StudentProfile } from '@/lib/types/database.types'
import { Pencil, X, Check } from 'lucide-react'

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

      // adminユーザー以外でバージョンが古ければ再認証ページへ
      if (!profileData?.is_admin && userVersion < currentVersion) {
        router.push('/verify-passphrase')
        return
      }

      if ((profileData as any)?.role !== 'student') {
        router.push('/')
        return
      }

      setProfile(profileData)

      // 生徒プロフィール取得
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
    const levels = {
      beginner: '初級',
      intermediate: '中級',
      advanced: '上級',
    }
    return levels[level as keyof typeof levels] || '未設定'
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
        <h1 className="text-2xl font-bold text-gray-900">プロフィール</h1>
        <p className="text-gray-600 mt-1">あなたの学習プロフィールを設定しましょう</p>
      </div>

      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-lg">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-bold">{profile?.full_name || '名前未設定'}</h2>
                <p className="text-indigo-100">{profile?.email}</p>
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
                  onClick={() => setEditing(false)}
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

        {/* コンテンツ */}
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              自己紹介
            </label>
            {editing ? (
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="あなたについて教えてください"
              />
            ) : (
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{studentProfile?.bio || '未設定'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              学習目標
            </label>
            {editing ? (
              <textarea
                value={formData.learning_goals}
                onChange={(e) => setFormData({ ...formData, learning_goals: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="どんな日本語を学びたいですか？"
              />
            ) : (
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{studentProfile?.learning_goals || '未設定'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              理想の先生像
            </label>
            {editing ? (
              <textarea
                value={formData.desired_teacher_type}
                onChange={(e) => setFormData({ ...formData, desired_teacher_type: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="どんな先生に教えてほしいですか？"
              />
            ) : (
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{studentProfile?.desired_teacher_type || '未設定'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              日本語レベル
            </label>
            {editing ? (
              <select
                value={formData.japanese_level}
                onChange={(e) => setFormData({ ...formData, japanese_level: e.target.value as any })}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                対応可能な時間帯
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.availability}
                  onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="例: 平日夕方、週末"
                />
              ) : (
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{studentProfile?.availability || '未設定'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                場所
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="例: トロント市内、ダウンタウン"
                />
              ) : (
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{studentProfile?.location || '未設定'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
