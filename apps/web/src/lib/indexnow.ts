// IndexNow — instant URL submission to Bing/Yandex/Seznam/Naver (Google does
// not consume IndexNow; it discovers via sitemap.xml instead). The key file
// lives at public/<key>.txt as the protocol requires.

export const INDEXNOW_KEY = 'f8a4c2e6d91b47358a0e6c1db2795f43'
const BASE = process.env.APP_URL ?? 'https://www.tudumm.in'

/** Fire-and-forget: never throws, never blocks the caller's response. */
export function pingIndexNow(paths: string[]): void {
  try {
    const host = new URL(BASE).host
    void fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
        urlList: paths.map(p => `${BASE}${p}`),
      }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => {})
  } catch {
    /* never let SEO pings break the request path */
  }
}
