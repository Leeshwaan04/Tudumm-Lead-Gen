import { INDEXNOW_KEY } from '@/lib/indexnow'

// IndexNow key verification file. Served as a route handler because the
// Railway standalone build does not ship public/ assets.
export function GET() {
  return new Response(INDEXNOW_KEY, { headers: { 'Content-Type': 'text/plain' } })
}
