import { Page } from 'playwright'

export interface FingerprintProfile {
  userAgent: string
  screenWidth: number
  screenHeight: number
  timezone: string
  language: string
  platform: string
  webglVendor: string
  webglRenderer: string
  canvasNoise: number
  audioContextNoise: number
  hardwareConcurrency: number
  deviceMemory: number
}

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
]
const RESOLUTIONS: [number, number][] = [[1920, 1080], [2560, 1440], [1440, 900], [1366, 768], [1280, 800], [1536, 864]]
const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Calcutta', 'Asia/Tokyo', 'Asia/Singapore']
const WEBGL_VENDORS = ['Google Inc. (Apple)', 'Google Inc. (NVIDIA)', 'Google Inc. (Intel)']
const WEBGL_RENDERERS = [
  'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)',
  'ANGLE (Apple, Apple M2, OpenGL 4.1)',
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080, OpenGL 4.5)',
  'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)',
]
const PLATFORMS: Record<string, string> = {
  'Mac': 'MacIntel',
  'Win': 'Win32',
  'Lin': 'Linux x86_64',
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min: number, max: number) { return Math.random() * (max - min) + min }

export function generateFingerprint(seed?: string): FingerprintProfile {
  const ua = pick(USER_AGENTS)
  const [sw, sh] = pick(RESOLUTIONS)
  const vendor = pick(WEBGL_VENDORS)
  const platform = ua.includes('Mac') ? 'MacIntel' : ua.includes('Windows') ? 'Win32' : 'Linux x86_64'
  return {
    userAgent: ua,
    screenWidth: sw,
    screenHeight: sh,
    timezone: pick(TIMEZONES),
    language: 'en-US',
    platform,
    webglVendor: vendor,
    webglRenderer: pick(WEBGL_RENDERERS),
    canvasNoise: rand(0.0001, 0.0003),
    audioContextNoise: rand(0.00001, 0.0001),
    hardwareConcurrency: pick([2, 4, 8, 12, 16]),
    deviceMemory: pick([4, 8, 16]),
  }
}

export async function applyFingerprint(page: Page, fp: FingerprintProfile): Promise<void> {
  await page.addInitScript((profile) => {
    // Override navigator properties
    Object.defineProperty(navigator, 'userAgent', { get: () => profile.userAgent })
    Object.defineProperty(navigator, 'platform', { get: () => profile.platform })
    Object.defineProperty(navigator, 'language', { get: () => profile.language })
    Object.defineProperty(navigator, 'languages', { get: () => [profile.language, 'en'] })
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => profile.hardwareConcurrency })
    Object.defineProperty(navigator, 'deviceMemory', { get: () => profile.deviceMemory })

    // Override screen
    Object.defineProperty(screen, 'width', { get: () => profile.screenWidth })
    Object.defineProperty(screen, 'height', { get: () => profile.screenHeight })
    Object.defineProperty(screen, 'availWidth', { get: () => profile.screenWidth })
    Object.defineProperty(screen, 'availHeight', { get: () => profile.screenHeight - 40 })

    // WebGL fingerprint
    const getParameter = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
      if (parameter === 37445) return profile.webglVendor
      if (parameter === 37446) return profile.webglRenderer
      return getParameter.call(this, parameter)
    }

    // Canvas noise
    const toDataURL = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const context = this.getContext('2d')
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height)
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] = Math.min(255, imageData.data[i] + Math.floor(profile.canvasNoise * 255))
        }
        context.putImageData(imageData, 0, 0)
      }
      return toDataURL.apply(this, args as [string?, number?])
    }
  }, fp)
}
