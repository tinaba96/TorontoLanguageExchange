'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database.types'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(profileData)
      }
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const goToDashboard = () => {
    if (profile?.role === 'teacher') {
      router.push('/teacher')
    } else if (profile?.role === 'student') {
      router.push('/student')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-xl text-gray-700">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* ログイン状態表示 */}
      {user && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{profile?.full_name || 'ユーザー'}</p>
              <p className="text-sm text-gray-500">
                {profile?.role === 'teacher' ? 'Japanese' : 'English Speaker'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="ml-4 text-sm text-gray-600 hover:text-gray-900"
            >
              ログアウト
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Toronto Language Exchange
        </h1>
        <p className="text-xl text-gray-700 mb-12">
          トロントで日本語を教えたい日本人と、日本語を学びたい英語話者をつなぐプラットフォーム
        </p>

        {user ? (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={goToDashboard}
              className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              ダッシュボードへ
            </button>
            <Link
              href="/messages"
              className="px-8 py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition-colors"
            >
              メッセージ
            </Link>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              ログイン
            </Link>
            <Link
              href="/signup"
              className="px-8 py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition-colors"
            >
              新規登録
            </Link>
          </div>
        )}

        {/* ログイン不要でアクセス可能 */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/announcements"
            className="px-8 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-semibold hover:border-indigo-600 hover:text-indigo-600 transition-colors"
          >
            全体告知を見る
          </Link>
          <Link
            href="/board"
            className="px-8 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-semibold hover:border-indigo-600 hover:text-indigo-600 transition-colors"
          >
            掲示板を見る
          </Link>
        </div>

        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          <Link href="/announcements" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              全体告知
            </h3>
            <p className="text-gray-600">
              運営からのお知らせやイベント情報をチェック
            </p>
            <p className="text-indigo-600 text-sm mt-2">ログイン不要</p>
          </Link>

          <Link href="/board" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              掲示板
            </h3>
            <p className="text-gray-600">
              ユーザー同士で情報交換や交流ができる掲示板
            </p>
            <p className="text-indigo-600 text-sm mt-2">ログイン不要</p>
          </Link>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              マッチング
            </h3>
            <p className="text-gray-600">
              日本人が教えたいEnglish Speakerを選んでマッチング
            </p>
            <p className="text-gray-400 text-sm mt-2">要ログイン</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              メッセージ
            </h3>
            <p className="text-gray-600">
              マッチング後すぐにメッセージでやり取り開始
            </p>
            <p className="text-gray-400 text-sm mt-2">要ログイン</p>
          </div>
        </div>
      </div>
    </div>
  )
}
