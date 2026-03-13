import http from 'node:http'
import { serveStatic } from './utils/serveStatic.js'
import { sendResponse } from './utils/sendResponse.js'
import {
  handleGet,
  handleGetById,
  handlePost,
  handleReact,
  handleReport,
  handleGetReports,
  handleHide,
  handleNewsletter,
  handleAnalytics,
  handleGetAnalytics,
  handleSitemap,
} from './handlers/routeHandlers.js'

const PORT = 8000
const __dirname = import.meta.dirname

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const { pathname } = url
  const segments = pathname.split('/').filter(Boolean)

  // /api
  if (pathname === '/api' || pathname === '/api/') {
    if (req.method === 'GET') return await handleGet(res)
    if (req.method === 'POST') return handlePost(req, res)
    return sendResponse(res, 405, 'application/json', JSON.stringify({ error: 'Method not allowed' }))
  }

  // /newsletter
  if (pathname === '/newsletter') {
    if (req.method === 'POST') return handleNewsletter(req, res)
    return sendResponse(res, 405, 'application/json', JSON.stringify({ error: 'Method not allowed' }))
  }

  // /analytics
  if (pathname === '/analytics') {
    if (req.method === 'POST') return handleAnalytics(req, res)
    if (req.method === 'GET') return handleGetAnalytics(req, res)
    return sendResponse(res, 405, 'application/json', JSON.stringify({ error: 'Method not allowed' }))
  }

  // /sitemap.xml
  if (pathname === '/sitemap.xml') {
    return handleSitemap(req, res)
  }

  // /api/:id[/:action]
  if (segments[0] === 'api' && segments.length >= 2) {
    const id = segments[1]
    const action = segments[2]

    if (id === 'reports' && !action && req.method === 'GET') return await handleGetReports(req, res)
    if (!action && req.method === 'GET') return await handleGetById(res, id)
    if (action === 'react' && req.method === 'POST') return handleReact(req, res, id)
    if (action === 'report' && req.method === 'POST') return handleReport(req, res, id)
    if (action === 'hide' && req.method === 'POST') return handleHide(req, res, id)

    return sendResponse(res, 404, 'application/json', JSON.stringify({ error: 'Not found' }))
  }

  return await serveStatic(req, res, __dirname)
})

server.listen(PORT, () => console.log(`Connected on port: ${PORT}`))
