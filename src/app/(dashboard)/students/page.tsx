'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { StudentWithProfile } from '@/lib/types/database.types'
import { X, MapPin, Clock, Target, Sparkles, User } from 'lucide-react'
import Avatar from '@/components/Avatar'

export default function StudentsListPage() {
  const [students, setStudents] = useState<StudentWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<StudentWithProfile | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          student_profile:student_profiles(*)
        `)
        .eq('role', 'student')

      if (error) throw error

      if (data) {
        const formatted: StudentWithProfile[] = data.map((s) => ({
          ...s,
          student_profile: Array.isArray(s.student_profile)
            ? s.student_profile[0] || null
            : s.student_profile || null,
        }))
        setStudents(formatted)
      }
    } catch (error) {
      console.error('Error loading students:', error)
    } finally {
      setLoading(false)
    }
  }

  const getLevelBadge = (level: string | null) => {
    const levels = {
      beginner: { label: '初級', color: 'bg-green-100 text-green-800' },
      intermediate: { label: '中級', color: 'bg-yellow-100 text-yellow-800' },
      advanced: { label: '上級', color: 'bg-red-100 text-red-800' },
    }
    const levelInfo = levels[level as keyof typeof levels] || { label: '未設定', color: 'bg-gray-100 text-gray-800' }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${levelInfo.color}`}>
        {levelInfo.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-gray-600">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">生徒一覧</h1>
        <p className="text-gray-600 mt-1">
          {students.length > 0
            ? `${students.length}名の生徒が登録されています`
            : '現在、登録されている生徒はいません'}
        </p>
      </div>

      {students.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center border border-gray-200">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-xl text-gray-600 mb-2">生徒はまだ登録されていません</p>
          <p className="text-gray-500">新しい生徒が登録されるまでお待ちください</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map((student) => (
            <div
              key={student.id}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200"
            >
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
                <div className="flex items-center mb-3">
                  <Avatar
                    url={student.avatar_url}
                    name={student.full_name}
                    fallback="S"
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-lg"
                  />
                  <div className="ml-4">
                    <h3 className="font-bold text-xl">{student.full_name || '名前未設定'}</h3>
                    <p className="text-indigo-100 text-sm">{student.email}</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  {getLevelBadge(student.student_profile?.japanese_level || null)}
                </div>
              </div>

              <div className="p-6 space-y-4">
                {student.student_profile?.bio ? (
                  <div>
                    <div className="flex items-center mb-2">
                      <User className="w-4 h-4 mr-2 text-gray-500" />
                      <h4 className="text-sm font-bold text-gray-700">自己紹介</h4>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3 pl-6">
                      {student.student_profile.bio}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 pl-6">自己紹介が未設定です</div>
                )}

                {student.student_profile?.learning_goals ? (
                  <div>
                    <div className="flex items-center mb-2">
                      <Target className="w-4 h-4 mr-2 text-gray-500" />
                      <h4 className="text-sm font-bold text-gray-700">学習目標</h4>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3 pl-6">
                      {student.student_profile.learning_goals}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 pl-6">学習目標が未設定です</div>
                )}

                {student.student_profile?.desired_teacher_type ? (
                  <div>
                    <div className="flex items-center mb-2">
                      <Sparkles className="w-4 h-4 mr-2 text-gray-500" />
                      <h4 className="text-sm font-bold text-gray-700">理想の先生像</h4>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 pl-6">
                      {student.student_profile.desired_teacher_type}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 pl-6">理想の先生像が未設定です</div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {student.student_profile?.location ? (
                    <span className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                      <MapPin className="w-3 h-3 mr-1" />
                      {student.student_profile.location}
                    </span>
                  ) : (
                    <span className="inline-flex items-center bg-gray-50 text-gray-400 px-3 py-1 rounded-full text-xs">
                      <MapPin className="w-3 h-3 mr-1" />
                      場所未設定
                    </span>
                  )}
                  {student.student_profile?.availability ? (
                    <span className="inline-flex items-center bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                      <Clock className="w-3 h-3 mr-1" />
                      {student.student_profile.availability}
                    </span>
                  ) : (
                    <span className="inline-flex items-center bg-gray-50 text-gray-400 px-3 py-1 rounded-full text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      時間未設定
                    </span>
                  )}
                </div>
              </div>

              <div className="px-6 pb-6">
                <button
                  onClick={() => setSelectedStudent(student)}
                  className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  詳細を見る
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white sticky top-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <Avatar
                    url={selectedStudent.avatar_url}
                    name={selectedStudent.full_name}
                    fallback="S"
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold text-3xl shadow-lg"
                  />
                  <div className="ml-4">
                    <h2 className="text-2xl font-bold">{selectedStudent.full_name || '名前未設定'}</h2>
                    <p className="text-indigo-100">{selectedStudent.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="mt-4">
                {getLevelBadge(selectedStudent.student_profile?.japanese_level || null)}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                  <User className="w-5 h-5 mr-2 text-indigo-600" />
                  自己紹介
                </h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedStudent.student_profile?.bio || '自己紹介が登録されていません'}
                </p>
              </div>

              <div>
                <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                  <Target className="w-5 h-5 mr-2 text-indigo-600" />
                  学習目標
                </h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedStudent.student_profile?.learning_goals || '学習目標が登録されていません'}
                </p>
              </div>

              <div>
                <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                  <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
                  理想の先生像
                </h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedStudent.student_profile?.desired_teacher_type || '理想の先生像が登録されていません'}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                    <MapPin className="w-5 h-5 mr-2 text-indigo-600" />
                    場所
                  </h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {selectedStudent.student_profile?.location || '未設定'}
                  </p>
                </div>

                <div>
                  <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                    <Clock className="w-5 h-5 mr-2 text-indigo-600" />
                    対応可能時間
                  </h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {selectedStudent.student_profile?.availability || '未設定'}
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
