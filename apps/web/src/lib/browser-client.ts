const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL || 'http://localhost:8007'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'dev-secret'
const WEB_URL = process.env.APP_URL || 'http://localhost:3000'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

export class BrowserClientError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) })
      if (res.status < 500) return res
      if (attempt === retries) return res
    } catch (err: any) {
      if (attempt === retries) throw new BrowserClientError(`Browser service unreachable after ${retries} attempts: ${err.message}`, 503)
    }
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt))
  }
  throw new BrowserClientError('Browser service failed', 503)
}

async function getProxyConfig(workspaceId: string): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${WEB_URL}/api/proxy/active?workspaceId=${workspaceId}&type=RESIDENTIAL`, {
      headers: { 'X-Internal-Secret': INTERNAL_SECRET },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.credentials ?? null
  } catch {
    return null
  }
}

export async function sendLinkedInConnection(
  workspaceId: string,
  sessionAlias: string,
  profileUrl: string,
  rawCookie: string,
  note?: string
) {
  const proxyCredentials = await getProxyConfig(workspaceId)

  const res = await fetchWithRetry(`${BROWSER_SERVICE_URL}/linkedin/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': INTERNAL_SECRET },
    body: JSON.stringify({ workspaceId, sessionAlias, profileUrl, rawCookie, note, proxyCredentials }),
  })

  const data = await res.json()
  if (!res.ok) throw new BrowserClientError(data.error || 'Failed to connect via browser service', res.status)
  return data
}

export async function sendLinkedInMessage(
  workspaceId: string,
  sessionAlias: string,
  profileUrl: string,
  rawCookie: string,
  body: string
) {
  const proxyCredentials = await getProxyConfig(workspaceId)

  const res = await fetchWithRetry(`${BROWSER_SERVICE_URL}/linkedin/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': INTERNAL_SECRET },
    body: JSON.stringify({ workspaceId, sessionAlias, profileUrl, rawCookie, body, proxyCredentials }),
  })

  const data = await res.json()
  if (!res.ok) throw new BrowserClientError(data.error || 'Failed to message via browser service', res.status)
  return data
}
