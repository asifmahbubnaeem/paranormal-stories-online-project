import sanitizeHtml from 'sanitize-html'

// Strip every HTML tag from user input – no HTML is ever stored.
// The frontend is responsible for safe rendering (textContent / <br> insertion).
const STRIP_ALL = { allowedTags: [], allowedAttributes: {} }

const MAX_LENGTHS = {
  title: 200,
  location: 100,
  text: 5000,
  displayName: 60,
  reason: 500,
}

export function sanitizeInput(data) {
  const sanitizedData = {}

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      let clean = sanitizeHtml(value, STRIP_ALL).trim()
      // Enforce per-field character limits
      const limit = MAX_LENGTHS[key]
      if (limit && clean.length > limit) clean = clean.slice(0, limit)
      sanitizedData[key] = clean
    } else if (Array.isArray(value)) {
      sanitizedData[key] = value
        .filter((item) => typeof item === 'string')
        .map((item) => sanitizeHtml(item, STRIP_ALL).trim())
    } else {
      sanitizedData[key] = value
    }
  }

  return sanitizedData
}
