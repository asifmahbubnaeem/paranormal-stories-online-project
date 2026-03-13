import { track } from '/analytics.js'

// Only run on the sightings page
const container = document.querySelector('.cards-container')
if (!container) throw new Error('No cards container – wrong page')

// ── HTML escaping ───────────────────────────────────────────────
// Use this for every user-supplied value inserted into innerHTML.
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

const TAGS = [
  { value: '', label: 'All' },
  { value: 'apparition', label: 'Apparition' },
  { value: 'poltergeist', label: 'Poltergeist' },
  { value: 'shadow_figure', label: 'Shadow Figure' },
  { value: 'sleep_paralysis', label: 'Sleep Paralysis' },
  { value: 'haunted_house', label: 'Haunted House' },
  { value: 'ufo', label: 'UFO' },
  { value: 'strange_sound', label: 'Strange Sound' },
  { value: 'premonition', label: 'Premonition' },
  { value: 'other', label: 'Other' },
]

// ── State ──────────────────────────────────────────────────────
let allSightings = []
const urlParams = new URLSearchParams(window.location.search)
const filters = {
  tag: urlParams.get('tag') || '',
  sort: urlParams.get('sort') || 'latest',
  location: urlParams.get('location') || '',
}

// ── Helpers ────────────────────────────────────────────────────
function getSightingId(card, index) {
  if (card.id) return card.id
  if (card.uuid) return card.uuid
  return String(index)
}

function formatTag(tag) {
  return tag.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function totalReactions(card) {
  if (!card.reactions) return 0
  return Object.values(card.reactions).reduce((s, n) => s + n, 0)
}

// ── Filter bar setup ───────────────────────────────────────────
function buildFilterBar() {
  const filterBar = document.getElementById('filterBar')
  if (!filterBar) return

  const tagPillsHTML = TAGS.map(
    ({ value, label }) =>
      `<button class="tag-pill${filters.tag === value ? ' active' : ''}" data-tag="${value}">${label}</button>`
  ).join('')

  filterBar.innerHTML = `
    <div class="filter-tags">${tagPillsHTML}</div>
    <div class="filter-controls">
      <input
        type="text"
        class="location-filter"
        id="locationFilter"
        placeholder="Filter by location…"
        aria-label="Filter by location"
        value="${filters.location}"
      >
      <select class="sort-select" id="sortSelect" aria-label="Sort sightings">
        <option value="latest"${filters.sort === 'latest' ? ' selected' : ''}>Latest first</option>
        <option value="reactions"${filters.sort === 'reactions' ? ' selected' : ''}>Most reactions</option>
      </select>
    </div>
  `

  filterBar.addEventListener('click', (e) => {
    const pill = e.target.closest('.tag-pill')
    if (!pill) return
    filters.tag = pill.dataset.tag
    updateURL()
    applyFiltersAndRender()
  })

  document.getElementById('locationFilter').addEventListener('input', (e) => {
    filters.location = e.target.value.trim()
    updateURL()
    applyFiltersAndRender()
  })

  document.getElementById('sortSelect').addEventListener('change', (e) => {
    filters.sort = e.target.value
    updateURL()
    applyFiltersAndRender()
  })
}

function updateURL() {
  const params = new URLSearchParams()
  if (filters.tag) params.set('tag', filters.tag)
  if (filters.sort !== 'latest') params.set('sort', filters.sort)
  if (filters.location) params.set('location', filters.location)
  const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
  history.replaceState(null, '', newUrl)
}

// ── Filtering & sorting ────────────────────────────────────────
function applyFiltersAndRender() {
  let filtered = [...allSightings]

  if (filters.tag) {
    filtered = filtered.filter(
      (s) => Array.isArray(s.tags) && s.tags.includes(filters.tag)
    )
  }

  if (filters.location) {
    const loc = filters.location.toLowerCase()
    filtered = filtered.filter((s) => s.location?.toLowerCase().includes(loc))
  }

  if (filters.sort === 'reactions') {
    filtered.sort((a, b) => totalReactions(b) - totalReactions(a))
  } else {
    // Latest first – reverse array (newest appended to end)
    filtered = filtered.slice().reverse()
  }

  renderCards(filtered)

  // Update active tag pill
  document.querySelectorAll('.tag-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.tag === filters.tag)
  })

  // Show empty state
  if (filtered.length === 0) {
    container.innerHTML =
      '<p class="no-results">No sightings match those filters. <button class="clear-filters-btn">Clear filters</button></p>'
  }
}

// ── Render cards ───────────────────────────────────────────────
function renderCards(cardsData) {
  let cardsHTML = ''

  cardsData.forEach((card, i) => {
    const id = getSightingId(card, i)
    const detailUrl = `/sighting.html?id=${encodeURIComponent(id)}`
    const r = card.reactions || { chilling: 0, terrifying: 0, skeptical: 0 }
    const isTrending = totalReactions(card) >= 10
    const tagsHTML =
      Array.isArray(card.tags) && card.tags.length
        ? `<div class="card-tags">${card.tags.map((t) => `<span class="tag-badge">${esc(formatTag(t))}</span>`).join('')}</div>`
        : ''
    const authorHTML = card.displayName
      ? `<p class="card-author">by ${esc(card.displayName)}</p>`
      : ''
    const trendingHTML = isTrending
      ? `<span class="trending-badge">🔥 Trending</span>`
      : ''

    // Text is stored as plain text (all HTML stripped at ingest).
    // We convert newlines to <br> ourselves – this is the only HTML we inject.
    const safeText = esc(card.text).replace(/\n/g, '<br>')

    cardsHTML += `
<article class="sighting-card" aria-labelledby="sighting-title-${i}">
  <p class="card-details">${esc(card.timeStamp)}, ${esc(card.location)}${trendingHTML ? ' ' + trendingHTML : ''}</p>
  ${authorHTML}
  <h3 id="sighting-title-${i}">${esc(card.title)}</h3>
  ${tagsHTML}
  <div class="sighting-text-wrapper">
    <p class="sighting-text">${safeText}</p>
  </div>
  <div class="card-reactions">
    <button class="reaction-btn" data-reaction="chilling" data-id="${esc(id)}" aria-label="Chilling">👻 <span class="reaction-count">${r.chilling || 0}</span></button>
    <button class="reaction-btn" data-reaction="terrifying" data-id="${esc(id)}" aria-label="Terrifying">😱 <span class="reaction-count">${r.terrifying || 0}</span></button>
    <button class="reaction-btn" data-reaction="skeptical" data-id="${esc(id)}" aria-label="Skeptical">🤔 <span class="reaction-count">${r.skeptical || 0}</span></button>
  </div>
  <div class="sighting-actions">
    <button class="read-more-btn" aria-expanded="false">Read in full</button>
    <a href="${esc(detailUrl)}" class="view-story-link">Open story page</a>
  </div>
</article>`
  })

  container.innerHTML = cardsHTML
}

// ── Event delegation on cards container ───────────────────────
container.addEventListener('click', async (e) => {
  // Clear filters button
  if (e.target.classList.contains('clear-filters-btn')) {
    filters.tag = ''
    filters.location = ''
    filters.sort = 'latest'
    updateURL()
    buildFilterBar()
    applyFiltersAndRender()
    return
  }

  // Read more / collapse
  if (e.target.classList.contains('read-more-btn')) {
    const button = e.target
    const card = button.closest('.sighting-card')
    const isExpanded = card.classList.toggle('expanded')
    button.setAttribute('aria-expanded', isExpanded ? 'true' : 'false')
    button.textContent = isExpanded ? 'Show less' : 'Read in full'
    return
  }

  // Reaction buttons
  const reactBtn = e.target.closest('.reaction-btn')
  if (reactBtn && !reactBtn.disabled) {
    const id = reactBtn.dataset.id
    const reaction = reactBtn.dataset.reaction
    const countEl = reactBtn.querySelector('.reaction-count')

    // Optimistic update
    reactBtn.disabled = true
    if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1

    // ── Analytics: reaction clicked ────────────────────────────
    track('reaction_clicked', { reaction, id, context: 'sightings_list' })

    try {
      await fetch(`/api/${encodeURIComponent(id)}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction }),
      })
    } catch (err) {
      console.error(err)
      if (countEl) countEl.textContent = parseInt(countEl.textContent) - 1
      reactBtn.disabled = false
    }
  }
})

// ── Bootstrap ─────────────────────────────────────────────────
buildFilterBar()

try {
  const res = await fetch('/api')
  allSightings = await res.json()
  applyFiltersAndRender()
} catch (err) {
  console.error(err)
  container.innerHTML = '<p class="no-results">Could not load sightings. The spirits are busy.</p>'
}
