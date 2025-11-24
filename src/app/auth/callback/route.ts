import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/lib/types/database.types'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()

    // 認証コードをセッショントークンと交換
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
    }

    // ユーザー情報を取得
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      console.log('User logged in:', user.id)

      // プロフィールを取得（データベーストリガーで既に作成されているはず）
      // 少し待ってからプロフィールを取得（トリガーの完了を待つ）
      await new Promise(resolve => setTimeout(resolve, 500))

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<{ role: Database['public']['Tables']['profiles']['Row']['role'] }>()

      if (profile) {
        console.log('Profile found with role:', profile.role)
        // ロールに応じてリダイレクト
        if (profile.role === 'teacher') {
          return NextResponse.redirect(`${origin}/teacher`)
        } else if (profile.role === 'student') {
          return NextResponse.redirect(`${origin}/student`)
        }
      } else {
        console.error('Profile not found:', profileError)
        // プロフィールが見つからない場合はログインページへ
        return NextResponse.redirect(`${origin}/login?error=profile_not_found`)
      }
    }
  }

  // デフォルトでログインページにリダイレクト
  return NextResponse.redirect(`${origin}/login`)
}
