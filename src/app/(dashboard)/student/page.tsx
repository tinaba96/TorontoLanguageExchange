'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile, StudentProfile } from '@/lib/types/database.types'

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

      // プロフィール取得
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

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
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">先生マッチング</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/announcements"
              className="text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              全体告知
            </Link>
            <Link
              href="/board"
              className="text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              掲示板
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

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">プロフィール</h2>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                編集する
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
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
                <p className="text-gray-700">{studentProfile?.bio || '未設定'}</p>
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
                <p className="text-gray-700">{studentProfile?.learning_goals || '未設定'}</p>
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
                <p className="text-gray-700">{studentProfile?.desired_teacher_type || '未設定'}</p>
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
                <p className="text-gray-700">
                  {studentProfile?.japanese_level === 'beginner' && '初級'}
                  {studentProfile?.japanese_level === 'intermediate' && '中級'}
                  {studentProfile?.japanese_level === 'advanced' && '上級'}
                </p>
              )}
            </div>

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
                <p className="text-gray-700">{studentProfile?.availability || '未設定'}</p>
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
                <p className="text-gray-700">{studentProfile?.location || '未設定'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
