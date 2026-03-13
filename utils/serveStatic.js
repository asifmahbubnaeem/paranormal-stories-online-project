import path from 'node:path'
import fs from 'node:fs/promises'
import { sendResponse } from './sendResponse.js'
import { getContentType } from './getContentType.js'

export async function serveStatic(req, res, basedir) {
  const pubDir = path.resolve(basedir, 'public')

  // Strip query string before resolving the file path
  const urlPath = req.url.split('?')[0]
  const requestedFile = urlPath === '/' ? 'index.html' : urlPath

  // path.join normalises any '..' or '//' segments, then path.resolve
  // gives us the absolute path so we can do a strict prefix check.
  const filePath = path.resolve(path.join(pubDir, requestedFile))

  // ── Path traversal guard ───────────────────────────────────────
  // Reject any path that escapes the public directory.
  if (!filePath.startsWith(pubDir + path.sep) && filePath !== pubDir) {
    sendResponse(res, 403, 'text/plain', 'Forbidden')
    return
  }

  const ext = path.extname(filePath)
  const contentType = getContentType(ext)

  try {
    const content = await fs.readFile(filePath)
    sendResponse(res, 200, contentType, content)
  } catch (err) {
    if (err.code === 'ENOENT') {
      try {
        const content = await fs.readFile(path.join(pubDir, '404.html'))
        sendResponse(res, 404, 'text/html', content)
      } catch {
        sendResponse(res, 404, 'text/html', '<html><body><h1>404 Not Found</h1></body></html>')
      }
    } else {
      sendResponse(res, 500, 'text/html', '<html><body><h1>500 Server Error</h1></body></html>')
    }
  }
}
