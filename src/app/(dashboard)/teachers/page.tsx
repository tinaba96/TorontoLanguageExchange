'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TeacherWithProfile } from '@/lib/types/database.types'
import { X, MapPin, User, DollarSign, BookOpen, Sparkles, ChevronRight, GraduationCap } from 'lucide-react'
import Avatar from '@/components/Avatar'

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
        .select(`*, teacher_profile:teacher_profiles(*)`)
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>
          先生一覧
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {teachers.length > 0
            ? `${teachers.length}名の先生が登録されています`
            : '現在、登録されている先生はいません'}
        </p>
      </div>

      {teachers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(79,70,229,0.08)' }}>
            <GraduationCap className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-slate-600 font-medium mb-1">先生はまだ登録されていません</p>
          <p className="text-sm text-slate-400">新しい先生が登録されるまでお待ちください</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {teachers.map((teacher) => (
            <div
              key={teacher.id}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
            >
              {/* Card gradient header */}
              <div
                className="relative h-20 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1E3A5F 60%, #4F46E5 100%)' }}
              >
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 30%, #FF6B6B 0%, transparent 50%)' }} />
              </div>

              <div className="px-5 pb-5">
                {/* Avatar */}
                <div className="flex items-end justify-between -mt-8 mb-4">
                  <div className="w-16 h-16 rounded-2xl ring-4 ring-white overflow-hidden shadow-md">
                    <Avatar
                      url={teacher.avatar_url}
                      name={teacher.full_name}
                      fallback="T"
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover"
                    />
                  </div>
                  {teacher.teacher_profile?.hourly_rate && (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-100">
                      <DollarSign className="w-3 h-3" />
                      ${(teacher.teacher_profile.hourly_rate / 100).toFixed(0)}/h
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-slate-900 mb-0.5" style={{ fontFamily: 'var(--font-syne)' }}>
                  {teacher.full_name || '名前未設定'}
                </h3>
                <p className="text-xs text-slate-400 mb-4 truncate">{teacher.email}</p>

                {/* Specialties */}
                {teacher.teacher_profile?.specialties && teacher.teacher_profile.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {teacher.teacher_profile.specialties.slice(0, 3).map((s, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: 'rgba(79,70,229,0.08)', color: '#4F46E5' }}
                      >
                        {s}
                      </span>
                    ))}
                    {teacher.teacher_profile.specialties.length > 3 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-400 bg-slate-100">
                        +{teacher.teacher_profile.specialties.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Bio snippet */}
                {teacher.teacher_profile?.bio && (
                  <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                    {teacher.teacher_profile.bio}
                  </p>
                )}

                {/* Location */}
                {teacher.teacher_profile?.location && (
                  <div className="flex items-center gap-1.5 mb-4">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500">{teacher.teacher_profile.location}</span>
                  </div>
                )}

                <button
                  onClick={() => setSelectedTeacher(teacher)}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"
                >
                  詳細を見る <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Teacher detail modal */}
      {selectedTeacher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div
              className="relative p-6 text-white rounded-t-3xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1E3A5F 60%, #4F46E5 100%)' }}
            >
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 30%, #FF6B6B 0%, transparent 50%)' }} />
              <div className="relative flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl ring-2 ring-white/30 overflow-hidden shadow-lg">
                    <Avatar
                      url={selectedTeacher.avatar_url}
                      name={selectedTeacher.full_name}
                      fallback="T"
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-syne)' }}>
                      {selectedTeacher.full_name || '名前未設定'}
                    </h2>
                    <p className="text-white/60 text-sm">{selectedTeacher.email}</p>
                    {selectedTeacher.teacher_profile?.hourly_rate && (
                      <span className="inline-flex items-center gap-1 mt-1.5 bg-white/20 text-white px-3 py-0.5 rounded-full text-xs font-semibold">
                        <DollarSign className="w-3 h-3" />
                        {formatRate(selectedTeacher.teacher_profile.hourly_rate)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTeacher(null)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4">
              {/* Bio */}
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(79,70,229,0.1)' }}>
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">自己紹介</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed pl-8">
                  {selectedTeacher.teacher_profile?.bio || <span className="text-slate-400 italic">自己紹介が登録されていません</span>}
                </p>
              </div>

              {/* Teaching experience */}
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                    <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">指導経験</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed pl-8">
                  {selectedTeacher.teacher_profile?.teaching_experience || <span className="text-slate-400 italic">指導経験が登録されていません</span>}
                </p>
              </div>

              {/* Specialties */}
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">得意分野</h3>
                </div>
                <div className="pl-8">
                  {selectedTeacher.teacher_profile?.specialties && selectedTeacher.teacher_profile.specialties.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedTeacher.teacher_profile.specialties.map((s, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full text-xs font-semibold"
                          style={{ background: 'rgba(79,70,229,0.08)', color: '#4F46E5' }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">得意分野が登録されていません</p>
                  )}
                </div>
              </div>

              {/* Location + Rate */}
              <div className="grid md:grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">場所</h3>
                  </div>
                  <p className="text-sm text-slate-600 pl-8">
                    {selectedTeacher.teacher_profile?.location || <span className="text-slate-400 italic">未設定</span>}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">レッスン料金</h3>
                  </div>
                  <p className="text-sm text-slate-600 pl-8">
                    {formatRate(selectedTeacher.teacher_profile?.hourly_rate) || <span className="text-slate-400 italic">未設定</span>}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTeacher(null)}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors mt-2"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
