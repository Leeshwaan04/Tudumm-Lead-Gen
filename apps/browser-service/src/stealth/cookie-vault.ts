import { Page, BrowserContext } from 'playwright'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { createClient } from 'redis'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.COOKIE_VAULT_KEY || 'a'.repeat(64), 'hex') // 32-byte hex key

function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

function decrypt(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.slice(0, 12)
  const tag = buf.slice(12, 28)
  const encrypted = buf.slice(28)
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

const SESSION_VALIDATORS: Record<string, (page: Page) => Promise<boolean>> = {
  linkedin: async (page) => {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 })
    return page.locator('.global-nav__me').isVisible().catch(() => false)
  },
  instagram: async (page) => {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 })
    return page.locator('[aria-label="Home"]').isVisible().catch(() => false)
  },
  twitter: async (page) => {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 15000 })
    return page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').isVisible().catch(() => false)
  },
}

export class CookieVault {
  private redis: ReturnType<typeof createClient>

  constructor(redis: ReturnType<typeof createClient>) {
    this.redis = redis
  }

  private key(workspaceId: string, platform: string, alias: string) {
    return `vault:${workspaceId}:${platform}:${alias}`
  }

  async storeCookie(workspaceId: string, platform: string, alias: string, cookieData: object): Promise<void> {
    const encrypted = encrypt(JSON.stringify(cookieData))
    await this.redis.set(this.key(workspaceId, platform, alias), encrypted)
  }

  async getCookie(workspaceId: string, platform: string, alias: string): Promise<object | null> {
    const encrypted = await this.redis.get(this.key(workspaceId, platform, alias))
    if (!encrypted) return null
    return JSON.parse(decrypt(encrypted))
  }

  async injectCookies(context: BrowserContext, workspaceId: string, platform: string, alias: string): Promise<void> {
    const cookies = await this.getCookie(workspaceId, platform, alias) as any[]
    if (!cookies) throw new Error(`No cookies found for ${platform}:${alias}`)
    await context.addCookies(cookies)
  }

  async validateSession(page: Page, platform: string): Promise<boolean> {
    const validator = SESSION_VALIDATORS[platform]
    if (!validator) return true
    return validator(page)
  }
}
