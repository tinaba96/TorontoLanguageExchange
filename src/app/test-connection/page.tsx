'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TestConnection() {
  const [status, setStatus] = useState<string>('テスト中...')
  const [details, setDetails] = useState<any>({})

  useEffect(() => {
    testConnection()
  }, [])

  const testConnection = async () => {
    try {
      const supabase = createClient()

      // 環境変数の確認
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      setDetails({
        url: url || 'undefined',
        keyLength: key ? key.length : 0,
        keyPrefix: key ? key.substring(0, 20) + '...' : 'undefined'
      })

      // Supabaseヘルスチェック
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        setStatus('エラー: ' + error.message)
      } else {
        setStatus('接続成功！')
      }
    } catch (err: any) {
      setStatus('エラー: ' + err.message)
      console.error('Connection test error:', err)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-bold mb-4">Supabase接続テスト</h1>

        <div className="mb-4">
          <p className="font-semibold">ステータス:</p>
          <p className={`text-lg ${status.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>
            {status}
          </p>
        </div>

        <div className="mb-4">
          <p className="font-semibold">環境変数:</p>
          <pre className="bg-gray-100 p-4 rounded mt-2 text-xs overflow-auto">
            {JSON.stringify(details, null, 2)}
          </pre>
        </div>

        <button
          onClick={testConnection}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          再テスト
        </button>
      </div>
    </div>
  )
}
