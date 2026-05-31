const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL || 'http://localhost:8007'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'dev-secret'

export class BrowserClientError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export async function sendLinkedInConnection(
  workspaceId: string,
  sessionAlias: string,
  profileUrl: string,
  rawCookie: string,
  note?: string
) {
  const res = await fetch(`${BROWSER_SERVICE_URL}/linkedin/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET,
    },
    body: JSON.stringify({
      workspaceId,
      sessionAlias,
      profileUrl,
      rawCookie,
      note,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new BrowserClientError(data.error || 'Failed to connect via browser service', res.status)
  }
  return data
}

export async function sendLinkedInMessage(
  workspaceId: string,
  sessionAlias: string,
  profileUrl: string,
  rawCookie: string,
  body: string
) {
  const res = await fetch(`${BROWSER_SERVICE_URL}/linkedin/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET,
    },
    body: JSON.stringify({
      workspaceId,
      sessionAlias,
      profileUrl,
      rawCookie,
      body,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new BrowserClientError(data.error || 'Failed to message via browser service', res.status)
  }
  return data
}
