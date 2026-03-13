/**
 * Lightweight privacy-first analytics client.
 * Fires named events to POST /analytics.
 * Never throws – analytics failures must not break the UX.
 *
 * Events tracked:
 *   story_viewed       { id, title, location, tags }
 *   story_submitted    { tags, hasDisplayName }
 *   story_shared       { network, id }
 *   reaction_clicked   { reaction, id }
 *   newsletter_signed_up {}
 */

export async function track(event, properties = {}) {
  try {
    await fetch('/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // keepalive lets the request complete even if the page is navigating away
      keepalive: true,
      body: JSON.stringify({ event, properties }),
    })
  } catch {
    // Silently swallow – analytics must never interrupt the user
  }
}
