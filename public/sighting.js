import { track } from '/analytics.js'

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function getSightingIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id')
}

function formatTag(tag) {
  return tag.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

let currentSighting = null
const id = getSightingIdFromUrl()

// ── Load & render sighting ─────────────────────────────────────
async function loadSighting() {
  const metaEl = document.getElementById('sighting-detail-meta')
  const titleEl = document.getElementById('sighting-detail-title')
  const bodyEl = document.getElementById('sighting-detail-body')

  if (!id) {
    titleEl.textContent = 'Sighting not found'
    bodyEl.textContent = 'No sighting ID was provided in the link.'
    return
  }

  try {
    const res = await fetch(`/api/${encodeURIComponent(id)}`)

    if (!res.ok) {
      titleEl.textContent = 'Sighting not found'
      bodyEl.textContent = 'This story may have been removed or the link is incorrect.'
      return
    }

    const sighting = await res.json()
    currentSighting = sighting

    // ── Analytics: story viewed ────────────────────────────────
    track('story_viewed', {
      id: sighting.id || sighting.uuid,
      title: sighting.title,
      location: sighting.location,
      tags: sighting.tags || [],
    })

    // ── SEO + OG: update title and meta tags dynamically ───────
    const cleanText = sighting.text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const excerpt = cleanText.slice(0, 150) + (cleanText.length > 150 ? '…' : '')
    const pageDescription = `${sighting.title} – A real paranormal encounter from ${sighting.location}. ${excerpt}`

    document.title = `${sighting.title} – From the Other Side`

    function setMeta(selector, attr, value) {
      const el = document.querySelector(selector)
      if (el) el.setAttribute(attr, value)
    }

    setMeta('meta[name="description"]', 'content', pageDescription)
    setMeta('meta[property="og:title"]', 'content', `${sighting.title} – From the Other Side`)
    setMeta('meta[property="og:description"]', 'content', pageDescription)
    setMeta('meta[property="og:url"]', 'content', window.location.href)

    // Meta line – textContent is safe, no HTML needed here
    metaEl.textContent = `${sighting.timeStamp}  ·  ${sighting.location}`

    // Optional author
    const authorEl = document.getElementById('sighting-detail-author')
    if (authorEl && sighting.displayName) {
      authorEl.textContent = `by ${sighting.displayName}`
      authorEl.hidden = false
    }

    // Title
    titleEl.textContent = sighting.title

    // Tags – tag values come from a fixed enum, but escape defensively
    const tagsEl = document.getElementById('sighting-detail-tags')
    if (tagsEl && Array.isArray(sighting.tags) && sighting.tags.length) {
      tagsEl.innerHTML = sighting.tags
        .map((t) => `<span class="tag-badge">${esc(formatTag(t))}</span>`)
        .join('')
    }

    // Body – text is plain (all HTML stripped at ingest).
    // Escape before inserting, then convert newlines to <br>.
    bodyEl.innerHTML = ''
    const para = document.createElement('p')
    para.innerHTML = esc(sighting.text).replace(/\n/g, '<br>')
    bodyEl.appendChild(para)

    // Reactions
    renderDetailReactions(sighting.reactions, id)

    // Similar CTA
    renderSimilarCta(sighting.tags)

    // Listen to story (TTS): show toolbar if supported and we have text
    initListenToStory(sighting)
  } catch (err) {
    console.error(err)
    document.getElementById('sighting-detail-title').textContent = 'Something went wrong'
    document.getElementById('sighting-detail-body').textContent =
      'The spirits in the server room are restless. Please try again.'
  }
}

// ── Listen to story (Text-to-Speech) ───────────────────────────
const ListenState = { idle: 'idle', playing: 'playing', paused: 'paused' }
let listenState = ListenState.idle

function getTextToSpeak(sighting) {
  if (!sighting?.text) return ''
  const title = (sighting.title || '').trim()
  const body = (sighting.text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return title ? `${title}. ${body}` : body
}

function setListenStatus(msg) {
  const el = document.getElementById('listenStatus')
  if (el) el.textContent = msg
}

function setListenUI(state) {
  const playBtn = document.getElementById('listenPlayBtn')
  const pauseBtn = document.getElementById('listenPauseBtn')
  const stopBtn = document.getElementById('listenStopBtn')
  if (!playBtn || !pauseBtn || !stopBtn) return

  playBtn.hidden = state === ListenState.playing && !window.speechSynthesis?.paused
  pauseBtn.hidden = state !== ListenState.playing || window.speechSynthesis?.paused
  stopBtn.hidden = state === ListenState.idle
}

function getListenSpeed() {
  const sel = document.getElementById('listenSpeed')
  return sel ? parseFloat(sel.value) || 1 : 1
}

function getVoices() {
  return window.speechSynthesis?.getVoices() ?? []
}

function populateVoiceSelect() {
  const sel = document.getElementById('listenVoice')
  if (!sel) return
  const currentValue = sel.value
  const voices = getVoices()
  sel.innerHTML = '<option value="">Default</option>'
  voices.forEach((voice) => {
    const opt = document.createElement('option')
    opt.value = voice.name
    opt.textContent = voice.name + (voice.lang ? ` (${voice.lang})` : '')
    sel.appendChild(opt)
  })
  if (currentValue && voices.some((v) => v.name === currentValue)) {
    sel.value = currentValue
  }
}

function getSelectedVoice() {
  const sel = document.getElementById('listenVoice')
  if (!sel?.value) return null
  return getVoices().find((v) => v.name === sel.value) ?? null
}

function speakStory() {
  if (!currentSighting || !window.speechSynthesis) return
  const text = getTextToSpeak(currentSighting)
  if (!text) {
    setListenStatus('Nothing to read.')
    return
  }

  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = getListenSpeed()
  u.lang = 'en-US'
  const voice = getSelectedVoice()
  if (voice) u.voice = voice

  u.onstart = () => {
    listenState = ListenState.playing
    setListenUI(listenState)
    setListenStatus('Playing…')
  }
  u.onend = u.onerror = () => {
    listenState = ListenState.idle
    setListenUI(listenState)
    setListenStatus('')
  }
  u.onpause = () => {
    listenState = ListenState.paused
    setListenUI(listenState)
    setListenStatus('Paused.')
  }
  u.onresume = () => {
    listenState = ListenState.playing
    setListenUI(listenState)
    setListenStatus('Playing…')
  }

  window.speechSynthesis.speak(u)
  listenState = ListenState.playing
  setListenUI(listenState)
  setListenStatus('Playing…')
}

function initListenToStory(sighting) {
  const container = document.getElementById('listenStory')
  if (!container) return
  if (!window.speechSynthesis || !getTextToSpeak(sighting)) {
    container.hidden = true
    return
  }

  container.hidden = false
  setListenStatus('')
  listenState = ListenState.idle
  setListenUI(listenState)

  populateVoiceSelect()
  if (window.speechSynthesis && !getVoices().length) {
    window.speechSynthesis.onvoiceschanged = () => populateVoiceSelect()
  }

  const playBtn = document.getElementById('listenPlayBtn')
  const pauseBtn = document.getElementById('listenPauseBtn')
  const stopBtn = document.getElementById('listenStopBtn')
  const speedEl = document.getElementById('listenSpeed')
  const voiceEl = document.getElementById('listenVoice')

  playBtn?.addEventListener('click', () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
    } else {
      speakStory()
    }
  })
  pauseBtn?.addEventListener('click', () => {
    if (listenState === ListenState.playing) window.speechSynthesis.pause()
  })
  stopBtn?.addEventListener('click', () => {
    window.speechSynthesis.cancel()
    listenState = ListenState.idle
    setListenUI(listenState)
    setListenStatus('')
  })
  speedEl?.addEventListener('change', () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.cancel()
      speakStory()
    }
  })
  voiceEl?.addEventListener('change', () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.cancel()
      speakStory()
    }
  })
}

window.addEventListener('beforeunload', () => {
  if (window.speechSynthesis) window.speechSynthesis.cancel()
})

// ── Reactions ─────────────────────────────────────────────────
function renderDetailReactions(reactions, sightingId) {
  const container = document.getElementById('detailReactions')
  if (!container) return
  const r = reactions || { chilling: 0, terrifying: 0, skeptical: 0 }

  const safeId = esc(sightingId)
  container.innerHTML = `
    <p class="reactions-title">How did this make you feel?</p>
    <div class="reactions-buttons">
      <button class="detail-reaction-btn" data-reaction="chilling" data-id="${safeId}">
        <span class="reaction-emoji">👻</span>
        <span class="reaction-label">Chilling</span>
        <span class="reaction-count">${r.chilling || 0}</span>
      </button>
      <button class="detail-reaction-btn" data-reaction="terrifying" data-id="${safeId}">
        <span class="reaction-emoji">😱</span>
        <span class="reaction-label">Terrifying</span>
        <span class="reaction-count">${r.terrifying || 0}</span>
      </button>
      <button class="detail-reaction-btn" data-reaction="skeptical" data-id="${safeId}">
        <span class="reaction-emoji">🤔</span>
        <span class="reaction-label">Skeptical</span>
        <span class="reaction-count">${r.skeptical || 0}</span>
      </button>
    </div>
  `
}

// Reaction clicks delegated from the card wrapper
document.querySelector('.sighting-detail-card')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.detail-reaction-btn')
  if (!btn || btn.disabled) return

  const reaction = btn.dataset.reaction
  const sightingId = btn.dataset.id
  const countEl = btn.querySelector('.reaction-count')

  btn.disabled = true
  if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1

  // ── Analytics: reaction clicked ──────────────────────────────
  track('reaction_clicked', { reaction, id: sightingId })

  try {
    await fetch(`/api/${encodeURIComponent(sightingId)}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction }),
    })
  } catch (err) {
    console.error(err)
    if (countEl) countEl.textContent = parseInt(countEl.textContent) - 1
    btn.disabled = false
  }
})

// ── Similar CTA ────────────────────────────────────────────────
function renderSimilarCta(tags) {
  const section = document.getElementById('similarCta')
  const link = document.getElementById('similarCtaLink')
  if (!section || !link) return

  const uploadUrl =
    Array.isArray(tags) && tags.length
      ? `/upload-sighting.html?tag=${encodeURIComponent(tags[0])}`
      : '/upload-sighting.html'

  link.href = uploadUrl
  section.hidden = false
}

// ── Share buttons ──────────────────────────────────────────────
function buildShareUrl(base, params) {
  const url = new URL(base)
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value)
  })
  return url.toString()
}

async function handleShareClick(network) {
  const helper = document.getElementById('sighting-share-helper')
  const pageUrl = new URL(window.location.href)
  pageUrl.searchParams.delete('utm_source')
  pageUrl.searchParams.delete('utm_medium')
  pageUrl.searchParams.set('utm_source', network)
  pageUrl.searchParams.set('utm_medium', 'share_button')
  const url = pageUrl.toString()
  const title = currentSighting?.title || 'From the Other Side'
  const text =
    (currentSighting?.text?.replace(/<[^>]+>/g, '').slice(0, 180).replace(/\s+/g, ' ') || '') + '…'

  // ── Analytics: story shared ──────────────────────────────────
  track('story_shared', {
    network,
    id: currentSighting?.id || currentSighting?.uuid,
  })

  try {
    if (network === 'native' && navigator.share) {
      await navigator.share({ title, text, url })
      if (helper) helper.textContent = 'Shared!'
      return
    }
    if (network === 'copy') {
      await navigator.clipboard.writeText(url)
      if (helper) helper.textContent = 'Link copied to clipboard.'
      return
    }

    let shareLink = ''
    if (network === 'twitter')
      shareLink = buildShareUrl('https://twitter.com/intent/tweet', { text: `${title} – `, url })
    else if (network === 'reddit')
      shareLink = buildShareUrl('https://www.reddit.com/submit', { title, url })
    else if (network === 'facebook')
      shareLink = buildShareUrl('https://www.facebook.com/sharer/sharer.php', { u: url })
    else if (network === 'whatsapp')
      shareLink = buildShareUrl('https://api.whatsapp.com/send', { text: `${title} – ${url}` })

    if (shareLink) {
      window.open(shareLink, '_blank', 'noopener')
      if (helper) helper.textContent = 'Opening share dialog…'
    }
  } catch (err) {
    console.error(err)
    if (helper) helper.textContent = 'The spirits blocked that share. Please try again.'
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.share-btn')
  if (!btn) return
  const network = btn.getAttribute('data-network')
  if (network) handleShareClick(network)
})

// ── Report ─────────────────────────────────────────────────────
document.getElementById('reportBtn')?.addEventListener('click', async () => {
  if (!id) return
  const reason = prompt('Why are you reporting this sighting? (optional)')
  if (reason === null) return

  try {
    const res = await fetch(`/api/${encodeURIComponent(id)}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'No reason given' }),
    })
    if (res.ok) alert('Thank you. This sighting has been reported for review.')
  } catch (err) {
    console.error(err)
  }
})

// ── Boot ──────────────────────────────────────────────────────
loadSighting()
