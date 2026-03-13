export function sendResponse(res, statusCode, contentType, payload) {
  // ── Security headers on every response ─────────────────────────
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  // Narrow CSP: same-origin resources only, no inline scripts, no eval.
  // Fonts/images from data URIs are allowed for emoji reaction buttons.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'"
  )

  res.statusCode = statusCode
  res.setHeader('Content-Type', contentType)
  res.end(payload)
}
