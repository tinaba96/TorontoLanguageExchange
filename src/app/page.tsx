import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Toronto Language Exchange
        </h1>
        <p className="text-xl text-gray-700 mb-12">
          日本語の先生と生徒をつなぐプラットフォーム
        </p>

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

        <div className="mt-16 grid md:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              生徒向け
            </h3>
            <p className="text-gray-600">
              自分に合った日本語の先生を見つけて、対面でレッスンを受けられます
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              先生向け
            </h3>
            <p className="text-gray-600">
              教えたい生徒を選んで、直接メッセージでやり取りできます
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              シンプル
            </h3>
            <p className="text-gray-600">
              面倒な手続きなし。マッチングしたら、すぐにメッセージ開始
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
