const MAX_BODY_BYTES = 100 * 1024 // 100 KB – enough for any legitimate sighting

export async function parseJSONBody(req) {
  let body = ''
  let byteCount = 0

  for await (const chunk of req) {
    byteCount += chunk.length
    if (byteCount > MAX_BODY_BYTES) {
      throw new Error('Request body too large')
    }
    body += chunk
  }

  try {
    return JSON.parse(body)
  } catch (err) {
    throw new Error(`Invalid JSON format: ${err}`)
  }
}
