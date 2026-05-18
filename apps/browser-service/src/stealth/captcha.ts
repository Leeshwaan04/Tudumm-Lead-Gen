import { Page } from 'playwright'
import axios from 'axios'

export type CaptchaType = 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'turnstile'

const TWOCAPTCHA_KEY = process.env.TWOCAPTCHA_API_KEY || ''
const API_BASE = 'https://2captcha.com'

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function detectCaptcha(page: Page): Promise<CaptchaType | null> {
  return page.evaluate(() => {
    if (document.querySelector('.g-recaptcha') || document.querySelector('#recaptcha')) return 'recaptcha_v2'
    if (document.querySelector('[data-sitekey]') && (window as any).grecaptcha?.execute) return 'recaptcha_v3'
    if (document.querySelector('.h-captcha') || document.querySelector('[data-hcaptcha-sitekey]')) return 'hcaptcha'
    if (document.querySelector('[data-cf-turnstile]') || document.querySelector('.cf-turnstile')) return 'turnstile'
    return null
  }) as Promise<CaptchaType | null>
}

async function getSitekey(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-sitekey]')
    return el?.getAttribute('data-sitekey') || ''
  })
}

async function submitToTwoCaptcha(params: Record<string, string>): Promise<string> {
  const res = await axios.post(`${API_BASE}/in.php`, null, {
    params: { key: TWOCAPTCHA_KEY, json: 1, ...params },
  })
  if (res.data.status !== 1) throw new Error(`2captcha submit error: ${res.data.request}`)
  const taskId = res.data.request

  for (let i = 0; i < 24; i++) {
    await sleep(5000)
    const poll = await axios.get(`${API_BASE}/res.php`, {
      params: { key: TWOCAPTCHA_KEY, action: 'get', id: taskId, json: 1 },
    })
    if (poll.data.status === 1) return poll.data.request
    if (poll.data.request !== 'CAPCHA_NOT_READY') throw new Error(`2captcha error: ${poll.data.request}`)
  }
  throw new Error('2captcha timeout after 2 minutes')
}

export async function solveCaptcha(page: Page, type: CaptchaType): Promise<string> {
  const pageUrl = page.url()
  const sitekey = await getSitekey(page)

  let token: string
  if (type === 'recaptcha_v2') {
    token = await submitToTwoCaptcha({ method: 'userrecaptcha', googlekey: sitekey, pageurl: pageUrl })
    await page.evaluate((t) => {
      const el = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement
      if (el) { el.value = t; el.dispatchEvent(new Event('change')) }
    }, token)
  } else if (type === 'hcaptcha') {
    token = await submitToTwoCaptcha({ method: 'hcaptcha', sitekey, pageurl: pageUrl })
    await page.evaluate((t) => {
      const el = document.querySelector('[name="h-captcha-response"]') as HTMLTextAreaElement
      if (el) { el.value = t; el.dispatchEvent(new Event('change')) }
    }, token)
  } else if (type === 'turnstile') {
    token = await submitToTwoCaptcha({ method: 'turnstile', sitekey, pageurl: pageUrl })
    await page.evaluate((t) => {
      const el = document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement
      if (el) { el.value = t }
    }, token)
  } else {
    throw new Error(`Unsupported captcha type: ${type}`)
  }

  return token
}

export async function solveIfPresent(page: Page): Promise<boolean> {
  const type = await detectCaptcha(page)
  if (!type) return false
  await solveCaptcha(page, type)
  return true
}
