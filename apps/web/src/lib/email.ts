// Email utilities: HTML escape, template interpolation, unsubscribe URL.

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => HTML_ENTITIES[c] ?? c)
}

/** Interpolate {{firstName}} etc with HTML-safe values. */
export function interpolate(template: string, lead: any, opts: { html?: boolean } = {}): string {
  const safe = (v: any) => {
    const s = v == null ? '' : String(v)
    return opts.html ? escapeHtml(s) : s
  }
  return template
    .replace(/\{\{firstName\}\}/g, safe(lead.firstName ?? lead.fullName?.split(' ')[0] ?? ''))
    .replace(/\{\{lastName\}\}/g, safe(lead.lastName ?? ''))
    .replace(/\{\{fullName\}\}/g, safe(lead.fullName ?? ''))
    .replace(/\{\{company\}\}/g, safe(lead.company ?? ''))
    .replace(/\{\{title\}\}/g, safe(lead.title ?? ''))
}

/**
 * Build the absolute unsubscribe URL for a given lead.
 * The token is the lead ID — opaque to outside but server can look up and mark unsubscribed.
 * For production hardening, sign with HMAC and verify on inbound.
 */
export function unsubscribeUrl(leadId: string): string {
  const base = process.env.APP_URL ?? 'https://app.tudumm.io'
  return `${base}/api/unsubscribe?lead=${encodeURIComponent(leadId)}`
}

/** Wrap a plain-text body into a CAN-SPAM-compliant HTML email with unsubscribe footer. */
export function wrapHtmlEmail(textBody: string, lead: any, unsubUrl: string): string {
  const safeBody = escapeHtml(textBody).replace(/\n/g, '<br>')
  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;color:#111;line-height:1.5;max-width:600px;margin:0 auto;padding:16px">
  <div>${safeBody}</div>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px">
  <p style="font-size:12px;color:#6b7280">
    Don't want these emails? <a href="${escapeHtml(unsubUrl)}" style="color:#6b7280">Unsubscribe</a>.
  </p>
</body></html>`
}
