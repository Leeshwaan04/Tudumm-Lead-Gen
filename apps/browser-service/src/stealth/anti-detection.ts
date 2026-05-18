import { Page } from 'playwright'

export async function applyAntiDetection(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // 1. Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })

    // 2. Mock chrome runtime
    ;(window as any).chrome = {
      runtime: {
        onConnect: { addListener: () => {} },
        onMessage: { addListener: () => {} },
      },
    }

    // 3. Fix permissions query
    const originalQuery = navigator.permissions.query.bind(navigator.permissions)
    navigator.permissions.query = (params: any) =>
      params.name === 'notifications'
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : originalQuery(params)

    // 4. Realistic plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins: any[] = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 },
        ]
        plugins.item = (i: number) => plugins[i]
        plugins.namedItem = (n: string) => plugins.find(p => p.name === n) || null
        plugins.refresh = () => {}
        Object.defineProperty(plugins, 'length', { get: () => plugins.length })
        return plugins
      },
    })

    // 5. Battery API mock
    if ('getBattery' in navigator) {
      ;(navigator as any).getBattery = () =>
        Promise.resolve({ charging: true, chargingTime: 0, dischargingTime: Infinity, level: 0.95 })
    }

    // 6. Connection API mock
    if ('connection' in navigator) {
      Object.defineProperty(navigator, 'connection', {
        get: () => ({ rtt: 50, effectiveType: '4g', downlink: 10, saveData: false }),
      })
    }

    // 7. iframe contentWindow stealth
    const origDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get() {
        const win = origDescriptor?.get?.call(this)
        if (!win) return win
        Object.defineProperty(win.navigator, 'webdriver', { get: () => undefined })
        return win
      },
    })
  })
}
