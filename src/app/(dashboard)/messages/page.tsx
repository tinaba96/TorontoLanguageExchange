'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile, MatchWithProfiles, MessageWithSender } from '@/lib/types/database.types'

export default function MessagesPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [matches, setMatches] = useState<MatchWithProfiles[]>([])
  const [selectedMatch, setSelectedMatch] = useState<MatchWithProfiles | null>(null)
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedMatch) {
      loadMessages(selectedMatch.id)

      // リアルタイム更新をサブスクライブ
      const channel = supabase
        .channel(`match-${selectedMatch.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `match_id=eq.${selectedMatch.id}`,
          },
          (payload) => {
            console.log('🔔 New message received:', payload)
            loadMessages(selectedMatch.id)
          }
        )
        .subscribe((status) => {
          console.log('📡 Realtime subscription status:', status)
        })

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [selectedMatch])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadData = async () => {
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

      setProfile(profileData)

      // マッチング一覧を取得
      const { data: matchesData } = await supabase
        .from('matches')
        .select(`
          *,
          teacher:teacher_id(*),
          student:student_id(*, student_profile:student_profiles(*))
        `)
        .or(`teacher_id.eq.${user.id},student_id.eq.${user.id}`)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (matchesData) {
        // データを MatchWithProfiles 型に変換
        const formattedMatches: MatchWithProfiles[] = matchesData.map((match: any) => ({
          ...match,
          teacher: Array.isArray(match.teacher) ? match.teacher[0] : match.teacher,
          student: {
            ...(Array.isArray(match.student) ? match.student[0] : match.student),
            student_profile: Array.isArray(match.student?.student_profile)
              ? match.student.student_profile[0] || null
              : match.student?.student_profile || null
          }
        }))
        setMatches(formattedMatches)

        // 最初のマッチングを選択
        if (formattedMatches.length > 0) {
          setSelectedMatch(formattedMatches[0])
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (matchId: string) => {
    try {
      const { data } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(*)
        `)
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })

      if (data) {
        const formattedMessages: MessageWithSender[] = data.map((msg: any) => ({
          ...msg,
          sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender
        }))
        setMessages(formattedMessages)
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedMatch || !profile) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          match_id: selectedMatch.id,
          sender_id: profile.id,
          content: newMessage.trim(),
        } as any)

      if (error) throw error

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('メッセージの送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getOtherUser = (match: MatchWithProfiles) => {
    if (!profile) return null
    return profile.id === match.teacher_id ? match.student : match.teacher
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
          <h1 className="text-2xl font-bold text-indigo-600">メッセージ</h1>
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
              href={profile?.role === 'teacher' ? '/teacher' : '/student'}
              className="text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              {profile?.role === 'teacher' ? '先生マッチング' : 'プロフィール'}
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

      <div className="max-w-7xl mx-auto px-4 py-6 h-[calc(100vh-80px)]">
        {matches.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
            まだマッチングがありません
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* マッチング一覧 */}
            <div className="col-span-12 md:col-span-4 bg-white rounded-lg shadow overflow-y-auto">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">マッチング一覧</h2>
              </div>
              <div className="divide-y">
                {matches.map((match) => {
                  const otherUser = getOtherUser(match)
                  return (
                    <button
                      key={match.id}
                      onClick={() => setSelectedMatch(match)}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedMatch?.id === match.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                          {otherUser?.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="font-semibold text-gray-900">
                            {otherUser?.full_name || '名前未設定'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {profile?.id === match.teacher_id ? '生徒' : '先生'}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* メッセージエリア */}
            <div className="col-span-12 md:col-span-8 bg-white rounded-lg shadow flex flex-col">
              {selectedMatch ? (
                <>
                  {/* ヘッダー */}
                  <div className="p-4 border-b">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                        {getOtherUser(selectedMatch)?.full_name?.charAt(0) || 'U'}
                      </div>
                      <div className="ml-3">
                        <p className="font-semibold text-gray-900">
                          {getOtherUser(selectedMatch)?.full_name || '名前未設定'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {profile?.id === selectedMatch.teacher_id ? '生徒' : '先生'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* メッセージ一覧 */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 mt-8">
                        メッセージを送信してみましょう
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isOwnMessage = message.sender_id === profile?.id
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                isOwnMessage
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-gray-200 text-gray-900'
                              }`}
                            >
                              <p className="text-sm">{message.content}</p>
                              <p
                                className={`text-xs mt-1 ${
                                  isOwnMessage ? 'text-indigo-200' : 'text-gray-500'
                                }`}
                              >
                                {new Date(message.created_at).toLocaleTimeString('ja-JP', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* メッセージ入力 */}
                  <form onSubmit={handleSendMessage} className="p-4 border-t">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="メッセージを入力..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <button
                        type="submit"
                        disabled={sending || !newMessage.trim()}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        送信
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  マッチングを選択してください
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
