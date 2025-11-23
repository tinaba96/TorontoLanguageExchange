'use client'

export default function DebugEnvPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Debug</h1>
      <div className="bg-white p-6 rounded shadow">
        <div className="mb-4">
          <strong>NEXT_PUBLIC_SUPABASE_URL:</strong>
          <pre className="mt-2 p-2 bg-gray-100 rounded">
            {url ? `✓ Set (${url.substring(0, 30)}...)` : '✗ Not set'}
          </pre>
        </div>
        <div className="mb-4">
          <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong>
          <pre className="mt-2 p-2 bg-gray-100 rounded">
            {key ? `✓ Set (${key.substring(0, 30)}...)` : '✗ Not set'}
          </pre>
        </div>
        <div className="mb-4">
          <strong>URL Length:</strong>
          <pre className="mt-2 p-2 bg-gray-100 rounded">
            {url?.length || 0} characters
          </pre>
        </div>
        <div className="mb-4">
          <strong>Key Length:</strong>
          <pre className="mt-2 p-2 bg-gray-100 rounded">
            {key?.length || 0} characters
          </pre>
        </div>
        <div className="mb-4">
          <strong>URL Type:</strong>
          <pre className="mt-2 p-2 bg-gray-100 rounded">
            {typeof url}
          </pre>
        </div>
        <div className="mb-4">
          <strong>Key Type:</strong>
          <pre className="mt-2 p-2 bg-gray-100 rounded">
            {typeof key}
          </pre>
        </div>
      </div>
    </div>
  )
}
