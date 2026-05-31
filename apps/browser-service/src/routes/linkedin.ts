import { Router } from 'express'
import pino from 'pino'
import { BrowserPool } from '../services/BrowserPool'

const logger = pino({ name: 'browser-service:linkedin' })
export const linkedinRouter: Router = Router()

// Internal Secret Auth Middleware
linkedinRouter.use((req, res, next) => {
  const secret = req.headers['x-internal-secret']
  if (process.env.INTERNAL_SECRET && secret !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized internal service call' })
  }
  next()
})

const parseCookies = (rawCookie: string | object[]) => {
  if (Array.isArray(rawCookie)) return rawCookie
  // If it's a raw string like "li_at=xyz", we need to convert to Playwright cookie objects
  if (typeof rawCookie === 'string') {
    const cookies = []
    const liAtMatch = rawCookie.match(/li_at=([^;]+)/)
    if (liAtMatch) {
      cookies.push({
        name: 'li_at',
        value: liAtMatch[1],
        domain: '.linkedin.com',
        path: '/'
      })
    }
    return cookies
  }
  return []
}

linkedinRouter.post('/connect', async (req, res) => {
  const { workspaceId, sessionAlias, profileUrl, note, rawCookie } = req.body
  const cookies = parseCookies(rawCookie)

  if (!profileUrl || cookies.length === 0) {
    return res.status(400).json({ error: 'Missing profileUrl or valid cookies' })
  }

  const pool = BrowserPool.getInstance()
  let session
  try {
    session = await pool.acquire()
    await session.context.addCookies(cookies)

    await session.page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    
    // Check if session is expired
    const loginIndicator = session.page.locator('#session_key')
    if (await loginIndicator.isVisible().catch(() => false)) {
      throw new Error('session_expired')
    }

    // Attempt to click Connect
    const connectButton = session.page.getByRole('button', { name: /Connect/i }).first()
    if (await connectButton.isVisible().catch(() => false)) {
      await connectButton.click()
      
      if (note) {
        const addNoteButton = session.page.getByRole('button', { name: /Add a note/i })
        if (await addNoteButton.isVisible().catch(() => false)) {
          await addNoteButton.click()
          await session.page.locator('textarea[name="message"]').fill(note)
          const sendButton = session.page.getByRole('button', { name: /Send/i, exact: true })
          await sendButton.click()
        } else {
          // Send without note if add note not available
          const sendButton = session.page.getByRole('button', { name: /Send/i, exact: true })
          if (await sendButton.isVisible().catch(() => false)) {
            await sendButton.click()
          }
        }
      } else {
        const sendButton = session.page.getByRole('button', { name: /Send/i, exact: true })
        if (await sendButton.isVisible().catch(() => false)) {
          await sendButton.click()
        }
      }
      return res.json({ success: true, status: 'connected' })
    }

    // Pending or already connected?
    const pendingButton = session.page.getByRole('button', { name: /Pending/i }).first()
    if (await pendingButton.isVisible().catch(() => false)) {
      return res.json({ success: true, status: 'already_pending' })
    }

    return res.json({ success: false, error: 'Could not find Connect button', status: 'failed' })

  } catch (err: any) {
    logger.error({ error: err.message, profileUrl }, 'LinkedIn connect failed')
    return res.status(500).json({ error: err.message })
  } finally {
    if (session) {
      await session.context.clearCookies()
      pool.release(session.id)
    }
  }
})

linkedinRouter.post('/message', async (req, res) => {
  const { workspaceId, sessionAlias, profileUrl, body, rawCookie } = req.body
  const cookies = parseCookies(rawCookie)

  if (!profileUrl || !body || cookies.length === 0) {
    return res.status(400).json({ error: 'Missing profileUrl, body, or valid cookies' })
  }

  const pool = BrowserPool.getInstance()
  let session
  try {
    session = await pool.acquire()
    await session.context.addCookies(cookies)

    await session.page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    
    // Check if session is expired
    const loginIndicator = session.page.locator('#session_key')
    if (await loginIndicator.isVisible().catch(() => false)) {
      throw new Error('session_expired')
    }

    // Attempt to click Message
    const messageButton = session.page.getByRole('button', { name: 'Message' }).first()
    if (await messageButton.isVisible().catch(() => false)) {
      await messageButton.click()
      
      const messageBox = session.page.locator('div[role="textbox"]')
      await messageBox.waitFor({ state: 'visible', timeout: 5000 })
      await messageBox.fill(body)
      
      const sendButton = session.page.getByRole('button', { name: 'Send' }).filter({ hasText: 'Send' })
      await sendButton.click()
      
      return res.json({ success: true, status: 'message_sent' })
    }

    return res.json({ success: false, error: 'Could not find Message button', status: 'failed' })

  } catch (err: any) {
    logger.error({ error: err.message, profileUrl }, 'LinkedIn message failed')
    return res.status(500).json({ error: err.message })
  } finally {
    if (session) {
      await session.context.clearCookies()
      pool.release(session.id)
    }
  }
})
