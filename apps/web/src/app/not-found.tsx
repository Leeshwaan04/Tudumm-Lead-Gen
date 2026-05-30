import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100 p-6">
      <h1 className="text-3xl font-semibold">404</h1>
      <p className="text-sm text-zinc-400">This page doesn't exist.</p>
      <Link href="/dashboard" className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
        Back to dashboard
      </Link>
    </div>
  )
}
