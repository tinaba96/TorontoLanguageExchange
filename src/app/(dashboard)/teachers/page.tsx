'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TeacherWithProfile } from '@/lib/types/database.types'
import { X, MapPin, User, DollarSign, BookOpen, Sparkles } from 'lucide-react'

export default function TeachersListPage() {
  const [teachers, setTeachers] = useState<TeacherWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithProfile | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadTeachers()
  }, [])

  const loadTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          teacher_profile:teacher_profiles(*)
        `)
        .eq('role', 'teacher')

      if (error) throw error

      if (data) {
        const formatted: TeacherWithProfile[] = data.map((t) => ({
          ...t,
          teacher_profile: Array.isArray(t.teacher_profile)
            ? t.teacher_profile[0] || null
            : t.teacher_profile || null,
        }))
        setTeachers(formatted)
      }
    } catch (error) {
      console.error('Error loading teachers:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatRate = (cents: number | null | undefined) => {
    if (!cents) return null
    return `$${(cents / 100).toFixed(2)} / 時間 (CAD)`
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
        <h1 className="text-2xl font-bold text-gray-900">先生一覧</h1>
        <p className="text-gray-600 mt-1">
          {teachers.length > 0
            ? `${teachers.length}名の先生が登録されています`
            : '現在、登録されている先生はいません'}
        </p>
      </div>

      {teachers.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center border border-gray-200">
          <div className="text-6xl mb-4">🎓</div>
          <p className="text-xl text-gray-600 mb-2">先生はまだ登録されていません</p>
          <p className="text-gray-500">新しい先生が登録されるまでお待ちください</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teachers.map((teacher) => (
            <div
              key={teacher.id}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200"
            >
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
                <div className="flex items-center mb-3">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-lg">
                    {teacher.full_name?.charAt(0) || 'T'}
                  </div>
                  <div className="ml-4">
                    <h3 className="font-bold text-xl">{teacher.full_name || '名前未設定'}</h3>
                    <p className="text-indigo-100 text-sm">{teacher.email}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {teacher.teacher_profile?.bio ? (
                  <div>
                    <div className="flex items-center mb-2">
                      <User className="w-4 h-4 mr-2 text-gray-500" />
                      <h4 className="text-sm font-bold text-gray-700">自己紹介</h4>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3 pl-6">
                      {teacher.teacher_profile.bio}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 pl-6">自己紹介が未設定です</div>
                )}

                {teacher.teacher_profile?.teaching_experience ? (
                  <div>
                    <div className="flex items-center mb-2">
                      <BookOpen className="w-4 h-4 mr-2 text-gray-500" />
                      <h4 className="text-sm font-bold text-gray-700">指導経験</h4>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3 pl-6">
                      {teacher.teacher_profile.teaching_experience}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 pl-6">指導経験が未設定です</div>
                )}

                {teacher.teacher_profile?.specialties && teacher.teacher_profile.specialties.length > 0 && (
                  <div>
                    <div className="flex items-center mb-2">
                      <Sparkles className="w-4 h-4 mr-2 text-gray-500" />
                      <h4 className="text-sm font-bold text-gray-700">得意分野</h4>
                    </div>
                    <div className="flex flex-wrap gap-1 pl-6">
                      {teacher.teacher_profile.specialties.map((s, i) => (
                        <span
                          key={i}
                          className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {teacher.teacher_profile?.location ? (
                    <span className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                      <MapPin className="w-3 h-3 mr-1" />
                      {teacher.teacher_profile.location}
                    </span>
                  ) : (
                    <span className="inline-flex items-center bg-gray-50 text-gray-400 px-3 py-1 rounded-full text-xs">
                      <MapPin className="w-3 h-3 mr-1" />
                      場所未設定
                    </span>
                  )}
                  {formatRate(teacher.teacher_profile?.hourly_rate) ? (
                    <span className="inline-flex items-center bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                      <DollarSign className="w-3 h-3 mr-1" />
                      {formatRate(teacher.teacher_profile?.hourly_rate)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center bg-gray-50 text-gray-400 px-3 py-1 rounded-full text-xs">
                      <DollarSign className="w-3 h-3 mr-1" />
                      料金未設定
                    </span>
                  )}
                </div>
              </div>

              <div className="px-6 pb-6">
                <button
                  onClick={() => setSelectedTeacher(teacher)}
                  className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  詳細を見る
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white sticky top-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold text-3xl shadow-lg">
                    {selectedTeacher.full_name?.charAt(0) || 'T'}
                  </div>
                  <div className="ml-4">
                    <h2 className="text-2xl font-bold">{selectedTeacher.full_name || '名前未設定'}</h2>
                    <p className="text-indigo-100">{selectedTeacher.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTeacher(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                  <User className="w-5 h-5 mr-2 text-indigo-600" />
                  自己紹介
                </h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedTeacher.teacher_profile?.bio || '自己紹介が登録されていません'}
                </p>
              </div>

              <div>
                <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                  <BookOpen className="w-5 h-5 mr-2 text-indigo-600" />
                  指導経験
                </h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedTeacher.teacher_profile?.teaching_experience || '指導経験が登録されていません'}
                </p>
              </div>

              <div>
                <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                  <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
                  得意分野
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {selectedTeacher.teacher_profile?.specialties && selectedTeacher.teacher_profile.specialties.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedTeacher.teacher_profile.specialties.map((s, i) => (
                        <span
                          key={i}
                          className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-700">得意分野が登録されていません</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                    <MapPin className="w-5 h-5 mr-2 text-indigo-600" />
                    場所
                  </h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {selectedTeacher.teacher_profile?.location || '未設定'}
                  </p>
                </div>

                <div>
                  <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                    <DollarSign className="w-5 h-5 mr-2 text-indigo-600" />
                    レッスン料金
                  </h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {formatRate(selectedTeacher.teacher_profile?.hourly_rate) || '未設定'}
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setSelectedTeacher(null)}
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
