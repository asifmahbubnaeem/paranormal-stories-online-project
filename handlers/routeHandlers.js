import { getData } from '../utils/getData.js'
import { sendResponse } from '../utils/sendResponse.js'
import { parseJSONBody } from '../utils/parseJSONBody.js'
import { addNewSighting } from '../utils/addNewSighting.js'
import { sanitizeInput } from '../utils/sanitizeInput.js'
import { updateSighting } from '../utils/updateSighting.js'
import path from 'node:path'
import fs from 'node:fs/promises'

const REPORTS_PATH = path.join('data', 'reports.json')
const NEWSLETTER_PATH = path.join('data', 'newsletter.json')
const ANALYTICS_PATH = path.join('data', 'analytics.json')
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_REACTIONS = ['chilling', 'terrifying', 'skeptical']
// Analytics: rolling cap so the file never grows unbounded
const ANALYTICS_MAX_EVENTS = 10000
// Server-side admin key – must be present as ?key= or X-Admin-Key header
const ADMIN_KEY = process.env.ADMIN_KEY || 'ghostadmin'

function isAdminAuthorized(req) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const keyParam = url.searchParams.get('key')
  const keyHeader = req.headers['x-admin-key']
  return keyParam === ADMIN_KEY || keyHeader === ADMIN_KEY
}

async function readJSON(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return []
  }
}

async function writeJSON(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

// ─── Sightings ──────────────────────────────────────────────────

export async function handleGet(res) {
  const data = await getData()
  sendResponse(res, 200, 'application/json', JSON.stringify(data.filter((s) => !s.hidden)))
}

export async function handleGetById(res, id) {
  const data = await getData()
  const sighting = data.find((item) => item.id === id || item.uuid === id)
  if (!sighting || sighting.hidden) {
    sendResponse(res, 404, 'application/json', JSON.stringify({ error: 'Sighting not found' }))
    return
  }
  sendResponse(res, 200, 'application/json', JSON.stringify(sighting))
}

export async function handlePost(req, res) {
  try {
    const parsedBody = await parseJSONBody(req)
    const sanitizedBody = sanitizeInput(parsedBody)
    const saved = await addNewSighting(sanitizedBody)
    sendResponse(res, 201, 'application/json', JSON.stringify(saved))
  } catch (err) {
    sendResponse(res, 400, 'application/json', JSON.stringify({ error: err?.message || String(err) }))
  }
}

// ─── Reactions ──────────────────────────────────────────────────

export async function handleReact(req, res, id) {
  try {
    const { reaction } = await parseJSONBody(req)
    if (!VALID_REACTIONS.includes(reaction)) {
      sendResponse(res, 400, 'application/json', JSON.stringify({ error: 'Invalid reaction' }))
      return
    }
    const updated = await updateSighting(id, (s) => {
      const r = s.reactions || { chilling: 0, terrifying: 0, skeptical: 0 }
      return { ...s, reactions: { ...r, [reaction]: (r[reaction] || 0) + 1 } }
    })
    if (!updated) {
      sendResponse(res, 404, 'application/json', JSON.stringify({ error: 'Sighting not found' }))
      return
    }
    sendResponse(res, 200, 'application/json', JSON.stringify(updated.reactions))
  } catch (err) {
    sendResponse(res, 400, 'application/json', JSON.stringify({ error: err?.message || String(err) }))
  }
}

// ─── Reports ────────────────────────────────────────────────────

export async function handleReport(req, res, id) {
  try {
    const body = await parseJSONBody(req)
    // Sanitize the reason before storing to prevent stored XSS in the admin panel
    const rawReason = typeof body?.reason === 'string' ? body.reason : 'No reason given'
    const { sanitizeInput } = await import('../utils/sanitizeInput.js')
    const { reason } = sanitizeInput({ reason: rawReason })
    const reports = await readJSON(REPORTS_PATH)
    reports.push({
      id,
      reason: reason || 'No reason given',
      reportedAt: new Date().toISOString(),
    })
    await writeJSON(REPORTS_PATH, reports)
    sendResponse(res, 201, 'application/json', JSON.stringify({ success: true }))
  } catch (err) {
    sendResponse(res, 400, 'application/json', JSON.stringify({ error: err?.message || String(err) }))
  }
}

export async function handleGetReports(req, res) {
  if (!isAdminAuthorized(req)) {
    sendResponse(res, 401, 'application/json', JSON.stringify({ error: 'Unauthorized' }))
    return
  }
  const reports = await readJSON(REPORTS_PATH)
  sendResponse(res, 200, 'application/json', JSON.stringify(reports))
}

// ─── Moderation ─────────────────────────────────────────────────

export async function handleHide(req, res, id) {
  if (!isAdminAuthorized(req)) {
    sendResponse(res, 401, 'application/json', JSON.stringify({ error: 'Unauthorized' }))
    return
  }
  try {
    const body = await parseJSONBody(req)
    const shouldHide = body?.hidden !== false
    const updated = await updateSighting(id, (s) => ({ ...s, hidden: shouldHide }))
    if (!updated) {
      sendResponse(res, 404, 'application/json', JSON.stringify({ error: 'Sighting not found' }))
      return
    }
    sendResponse(res, 200, 'application/json', JSON.stringify({ success: true, hidden: shouldHide }))
  } catch (err) {
    sendResponse(res, 400, 'application/json', JSON.stringify({ error: err?.message || String(err) }))
  }
}

// ─── Analytics ──────────────────────────────────────────────────

const VALID_EVENTS = [
  'story_viewed',
  'story_submitted',
  'story_shared',
  'reaction_clicked',
  'newsletter_signed_up',
]

export async function handleAnalytics(req, res) {
  try {
    const body = await parseJSONBody(req)
    const event = body?.event
    if (!VALID_EVENTS.includes(event)) {
      sendResponse(res, 400, 'application/json', JSON.stringify({ error: 'Unknown event' }))
      return
    }

    const entry = {
      event,
      properties: body?.properties || {},
      timestamp: new Date().toISOString(),
    }

    const log = await readJSON(ANALYTICS_PATH)
    log.push(entry)

    // Keep only the most recent events to cap file size
    const trimmed = log.length > ANALYTICS_MAX_EVENTS
      ? log.slice(log.length - ANALYTICS_MAX_EVENTS)
      : log

    await writeJSON(ANALYTICS_PATH, trimmed)
    // Respond immediately; don't block the client
    sendResponse(res, 202, 'application/json', JSON.stringify({ ok: true }))
  } catch (err) {
    // Analytics failures must never break the user experience
    sendResponse(res, 202, 'application/json', JSON.stringify({ ok: true }))
  }
}

export async function handleGetAnalytics(req, res) {
  if (!isAdminAuthorized(req)) {
    sendResponse(res, 401, 'application/json', JSON.stringify({ error: 'Unauthorized' }))
    return
  }
  const log = await readJSON(ANALYTICS_PATH)
  sendResponse(res, 200, 'application/json', JSON.stringify(log))
}

// ─── Sitemap ─────────────────────────────────────────────────────

export async function handleSitemap(req, res) {
  try {
    const data = await getData()
    const host = req.headers.host || 'localhost:8000'
    const base = `http://${host}`
    const visible = data.filter((s) => !s.hidden)

    const staticPages = [
      { loc: `${base}/`, priority: '1.0', changefreq: 'daily' },
      { loc: `${base}/sightings.html`, priority: '0.9', changefreq: 'hourly' },
      { loc: `${base}/upload-sighting.html`, priority: '0.7', changefreq: 'monthly' },
    ]

    const storyPages = visible.map((s) => ({
      loc: `${base}/sighting.html?id=${encodeURIComponent(s.id || s.uuid)}`,
      priority: '0.8',
      changefreq: 'weekly',
    }))

    const allPages = [...staticPages, ...storyPages]

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (p) => `  <url>
    <loc>${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.end(xml)
  } catch (err) {
    sendResponse(res, 500, 'text/plain', 'Sitemap generation failed')
  }
}

// ─── Newsletter ─────────────────────────────────────────────────

export async function handleNewsletter(req, res) {
  try {
    const body = await parseJSONBody(req)
    const email = body?.email?.trim()
    if (!email || !EMAIL_REGEX.test(email)) {
      sendResponse(res, 400, 'application/json', JSON.stringify({ error: 'Invalid email address' }))
      return
    }
    const subscribers = await readJSON(NEWSLETTER_PATH)
    if (subscribers.includes(email)) {
      sendResponse(res, 200, 'application/json', JSON.stringify({ already: true }))
      return
    }
    subscribers.push(email)
    await writeJSON(NEWSLETTER_PATH, subscribers)
    sendResponse(res, 201, 'application/json', JSON.stringify({ success: true }))
  } catch (err) {
    sendResponse(res, 400, 'application/json', JSON.stringify({ error: err?.message || String(err) }))
  }
}
