import { Page } from 'playwright'

function gaussianRandom(mean: number, std: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function typeText(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector)
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    // Occasional typo simulation (2% chance)
    if (Math.random() < 0.02 && i < text.length - 1) {
      const typo = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1))
      await page.keyboard.type(typo)
      await sleep(gaussianRandom(120, 40))
      await page.keyboard.press('Backspace')
      await sleep(gaussianRandom(80, 30))
    }
    await page.keyboard.type(char)
    await sleep(Math.max(30, gaussianRandom(80, 30)))
  }
}

export async function moveMouse(page: Page, targetX: number, targetY: number): Promise<void> {
  const mouse = page.mouse
  // Get current position approximation — start from a random nearby position
  const startX = targetX + (Math.random() - 0.5) * 200
  const startY = targetY + (Math.random() - 0.5) * 200
  const steps = Math.floor(Math.random() * 10) + 8

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // Bezier easing
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    const jitterX = (Math.random() - 0.5) * 4
    const jitterY = (Math.random() - 0.5) * 4
    await mouse.move(
      startX + (targetX - startX) * ease + jitterX,
      startY + (targetY - startY) * ease + jitterY,
    )
    await sleep(Math.random() * 15 + 5)
  }
}

export async function randomDelay(min: number, max: number): Promise<void> {
  await sleep(Math.random() * (max - min) + min)
}

export async function randomPause(): Promise<void> {
  await sleep(gaussianRandom(4000, 1500))
}

export async function clickElement(page: Page, selector: string): Promise<void> {
  const el = page.locator(selector).first()
  const box = await el.boundingBox()
  if (!box) {
    await el.click()
    return
  }
  const x = box.x + box.width / 2 + (Math.random() - 0.5) * 4
  const y = box.y + box.height / 2 + (Math.random() - 0.5) * 4
  await moveMouse(page, x, y)
  await sleep(gaussianRandom(120, 40))
  await page.mouse.click(x, y)
  await sleep(gaussianRandom(200, 60))
}

export async function scrollNaturally(page: Page, targetY: number): Promise<void> {
  const currentY: number = await page.evaluate(() => window.scrollY)
  const distance = targetY - currentY
  const steps = Math.abs(Math.floor(distance / 100)) + 5

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    await page.evaluate((y) => window.scrollTo(0, y), currentY + distance * ease)
    await sleep(Math.random() * 30 + 10)
  }
}
