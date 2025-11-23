import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/lib/types/database.types'

export const createClient = () => {
  // 環境変数を直接参照（Next.jsのビルド時に置換される）
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // デバッグ情報（本番環境では削除推奨）
  if (typeof window !== 'undefined') {
    console.log('Supabase URL exists:', !!supabaseUrl)
    console.log('Supabase Key exists:', !!supabaseAnonKey)
    console.log('Supabase URL value:', supabaseUrl?.substring(0, 20) + '...')
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables.'
    )
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
