function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

const key = new URLSearchParams(window.location.search).get('key')
const content = document.getElementById('adminContent')

async function initAdmin() {
  if (!key || key.trim() === '') {
    content.innerHTML =
      '<p class="admin-access-msg">Restricted access. Add <code>?key=YOUR_ADMIN_KEY</code> to the URL (use the value from your server’s ADMIN_KEY).</p>'
    return
  }
  content.innerHTML = '<p class="admin-access-msg">Checking access…</p>'
  const res = await fetch(`/api/reports?key=${encodeURIComponent(key)}`)
  if (res.status === 401) {
    content.innerHTML =
      '<p class="admin-access-msg">Invalid key. Access denied. Use the key set in your server’s ADMIN_KEY.</p>'
    return
  }
  loadPendingStories()
  loadReports()
  loadSubscribers()
  renderNotifyPanel()
}

initAdmin()

async function loadPendingStories() {
  const section = document.createElement('section')
  section.className = 'admin-section'
  section.id = 'pendingSection'
  section.innerHTML = '<h2 class="admin-section-title">Pending Stories</h2><p class="admin-access-msg">Loading…</p>'
  const main = document.querySelector('main')
  main.insertBefore(section, main.firstChild)

  try {
    const res = await fetch(`/api/pending?key=${encodeURIComponent(key)}`)
    if (res.status === 401) {
      section.innerHTML = '<h2 class="admin-section-title">Pending Stories</h2><p class="admin-access-msg">Unauthorized.</p>'
      return
    }
    const pending = await res.json()
    if (!pending.length) {
      section.innerHTML = `
        <h2 class="admin-section-title">Pending Stories</h2>
        <p class="admin-count">0 pending</p>
        <p class="admin-access-msg">New submissions will appear here. Approve to publish and notify newsletter subscribers.</p>
      `
      return
    }
    section.innerHTML = `
      <h2 class="admin-section-title">Pending Stories</h2>
      <p class="admin-count">${pending.length} awaiting approval</p>
      ${pending
        .map(
          (s) => `
        <div class="admin-report-card admin-pending-card" data-id="${esc(s.id)}">
          <p><strong>${esc(s.title)}</strong></p>
          <p><strong>Location:</strong> ${esc(s.location)} · <strong>By:</strong> ${esc(s.displayName || 'Anonymous')}</p>
          <p class="admin-pending-preview">${esc((s.text || '').slice(0, 200))}${(s.text || '').length > 200 ? '…' : ''}</p>
          <div class="admin-pending-actions">
            <button type="button" class="admin-btn admin-btn--approve" data-id="${esc(s.id)}">Approve &amp; Notify Subscribers</button>
            <button type="button" class="admin-btn admin-btn--disapprove" data-id="${esc(s.id)}">Disapprove</button>
            <a href="/sighting.html?id=${encodeURIComponent(s.id)}" target="_blank" class="admin-preview-link">Preview ↗</a>
          </div>
          <p class="admin-pending-status" data-status="${esc(s.id)}"></p>
        </div>`
        )
        .join('')}
    `
    section.addEventListener('click', async (e) => {
      const approveBtn = e.target.closest('.admin-btn--approve')
      const disapproveBtn = e.target.closest('.admin-btn--disapprove')
      const card = e.target.closest('.admin-pending-card')
      if (!card) return
      const id = card.dataset.id
      const statusEl = card.querySelector('.admin-pending-status')

      if (approveBtn && !approveBtn.disabled) {
        approveBtn.disabled = true
        approveBtn.textContent = 'Approving & sending…'
        statusEl.textContent = ''
        try {
          const res = await fetch(`/api/${encodeURIComponent(id)}/approve?key=${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
          const data = await res.json()
          if (data.success) {
            statusEl.textContent = `Approved. Notified ${data.notification?.sent ?? 0} subscribers.`
            statusEl.className = 'admin-pending-status admin-pending-status--ok'
            card.remove()
            const countEl = section.querySelector('.admin-count')
            const left = section.querySelectorAll('.admin-pending-card').length
            if (countEl) countEl.textContent = left ? `${left} awaiting approval` : '0 pending'
          } else {
            statusEl.textContent = data.error || 'Failed to approve'
            statusEl.className = 'admin-pending-status admin-pending-status--error'
            approveBtn.disabled = false
            approveBtn.textContent = 'Approve & Notify Subscribers'
          }
        } catch (err) {
          statusEl.textContent = 'Network error. Try again.'
          statusEl.className = 'admin-pending-status admin-pending-status--error'
          approveBtn.disabled = false
          approveBtn.textContent = 'Approve & Notify Subscribers'
        }
        return
      }
      if (disapproveBtn && !disapproveBtn.disabled) {
        if (!confirm('Disapprove this story? It will be hidden from the site.')) return
        disapproveBtn.disabled = true
        disapproveBtn.textContent = 'Disapproving…'
        statusEl.textContent = ''
        try {
          const res = await fetch(`/api/${encodeURIComponent(id)}/disapprove?key=${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
          const data = await res.json()
          if (data.success) {
            statusEl.textContent = 'Disapproved (hidden).'
            statusEl.className = 'admin-pending-status admin-pending-status--warn'
            card.remove()
            const countEl = section.querySelector('.admin-count')
            const left = section.querySelectorAll('.admin-pending-card').length
            if (countEl) countEl.textContent = left ? `${left} awaiting approval` : '0 pending'
          } else {
            statusEl.textContent = data.error || 'Failed'
            statusEl.className = 'admin-pending-status admin-pending-status--error'
            disapproveBtn.disabled = false
            disapproveBtn.textContent = 'Disapprove'
          }
        } catch (err) {
          statusEl.textContent = 'Network error. Try again.'
          statusEl.className = 'admin-pending-status admin-pending-status--error'
          disapproveBtn.disabled = false
          disapproveBtn.textContent = 'Disapprove'
        }
      }
    })
  } catch (err) {
    section.innerHTML = '<h2 class="admin-section-title">Pending Stories</h2><p class="admin-access-msg">Error loading pending stories.</p>'
    console.error(err)
  }
}

function renderNotifyPanel() {
  const section = document.createElement('section')
  section.className = 'admin-section'
  section.innerHTML = `
    <h2 class="admin-section-title">Notify Subscribers</h2>
    <p class="admin-notify-hint">Load the latest sighting or enter details manually, then send an email to all active subscribers.</p>
    <div class="admin-notify-form">
      <div class="admin-notify-row">
        <input id="notifyTitle" class="admin-notify-input" type="text" placeholder="Story title…" aria-label="Story title">
        <input id="notifyId"    class="admin-notify-input" type="text" placeholder="Story ID (optional)" aria-label="Story ID">
        <button id="loadLatestBtn" class="admin-btn admin-btn--load">Load Latest</button>
      </div>
      <button id="sendNotifyBtn" class="admin-btn admin-btn--send">Send to Subscribers</button>
      <p id="notifyStatus" class="admin-notify-status"></p>
    </div>
  `
  document.querySelector('main').appendChild(section)

  document.getElementById('loadLatestBtn').addEventListener('click', async () => {
    const btn = document.getElementById('loadLatestBtn')
    btn.disabled = true
    btn.textContent = 'Loading…'
    try {
      const res     = await fetch('/api')
      const stories = await res.json()
      if (!stories.length) {
        document.getElementById('notifyStatus').textContent = 'No stories found.'
        return
      }
      const latest = stories[stories.length - 1]
      document.getElementById('notifyTitle').value = latest.title || ''
      document.getElementById('notifyId').value    = latest.id   || latest.uuid || ''
      document.getElementById('notifyStatus').textContent = ''
    } catch {
      document.getElementById('notifyStatus').textContent = 'Could not load stories.'
    } finally {
      btn.disabled = false
      btn.textContent = 'Load Latest'
    }
  })

  document.getElementById('sendNotifyBtn').addEventListener('click', async () => {
    const title   = document.getElementById('notifyTitle').value.trim()
    const storyId = document.getElementById('notifyId').value.trim()
    const status  = document.getElementById('notifyStatus')
    const btn     = document.getElementById('sendNotifyBtn')

    if (!title) {
      status.textContent = 'Please enter a story title first.'
      status.className   = 'admin-notify-status admin-notify-status--error'
      return
    }

    if (!confirm(`Send email to all active subscribers about:\n\n"${title}"\n\nProceed?`)) return

    btn.disabled    = true
    btn.textContent = 'Sending…'
    status.textContent = ''
    status.className   = 'admin-notify-status'

    try {
      const res  = await fetch(`/newsletter/notify?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, storyId }),
      })
      const data = await res.json()

      if (res.ok) {
        status.textContent = `Done — ${data.sent} sent, ${data.failed} failed.`
        status.className   = data.failed > 0
          ? 'admin-notify-status admin-notify-status--warn'
          : 'admin-notify-status admin-notify-status--ok'
      } else {
        status.textContent = data.error || 'Server error.'
        status.className   = 'admin-notify-status admin-notify-status--error'
      }
    } catch {
      status.textContent = 'Network error. Please try again.'
      status.className   = 'admin-notify-status admin-notify-status--error'
    } finally {
      btn.disabled    = false
      btn.textContent = 'Send to Subscribers'
    }
  })
}

async function loadSubscribers() {
  const section = document.createElement('section')
  section.className = 'admin-section'
  section.id = 'subscribersSection'
  section.innerHTML = '<h2 class="admin-section-title">Newsletter Subscribers</h2><p class="admin-access-msg">Loading…</p>'
  document.querySelector('main').appendChild(section)

  try {
    const res = await fetch(`/newsletter/subscribers?key=${encodeURIComponent(key)}`)
    if (res.status === 401) {
      section.innerHTML = '<h2 class="admin-section-title">Newsletter Subscribers</h2><p class="admin-access-msg">Unauthorized.</p>'
      return
    }
    const subscribers = await res.json()
    const active       = subscribers.filter((s) => !s.unsubscribed_at)
    const unsubscribed = subscribers.filter((s) => s.unsubscribed_at)

    section.innerHTML = `
      <h2 class="admin-section-title">Newsletter Subscribers</h2>
      <p class="admin-count">
        ${active.length} active &nbsp;·&nbsp; ${unsubscribed.length} unsubscribed
      </p>
      ${active.length === 0
        ? '<p class="admin-access-msg">No active subscribers yet.</p>'
        : `<table class="admin-table">
            <thead><tr><th>Email</th><th>Source</th><th>Subscribed</th></tr></thead>
            <tbody>
              ${active.map((s) => `
                <tr>
                  <td>${esc(s.email)}</td>
                  <td>${esc(s.source)}</td>
                  <td>${esc(new Date(s.created_at).toLocaleDateString())}</td>
                </tr>`).join('')}
            </tbody>
          </table>`}
      ${unsubscribed.length > 0
        ? `<details class="admin-unsub-details">
            <summary>${unsubscribed.length} unsubscribed (retained for compliance)</summary>
            <table class="admin-table">
              <thead><tr><th>Email</th><th>Source</th><th>Unsubscribed</th></tr></thead>
              <tbody>
                ${unsubscribed.map((s) => `
                  <tr>
                    <td>${esc(s.email)}</td>
                    <td>${esc(s.source)}</td>
                    <td>${esc(new Date(s.unsubscribed_at).toLocaleDateString())}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </details>`
        : ''}
    `
  } catch (err) {
    section.innerHTML = '<h2 class="admin-section-title">Newsletter Subscribers</h2><p class="admin-access-msg">Error loading subscribers.</p>'
    console.error(err)
  }
}

async function loadReports() {
  try {
    // Pass key as query parameter so the server-side guard accepts it
    const res = await fetch(`/api/reports?key=${encodeURIComponent(key)}`)

    if (res.status === 401) {
      content.innerHTML = '<p class="admin-access-msg">Server rejected the admin key.</p>'
      return
    }

    const reports = await res.json()

    if (!reports.length) {
      content.innerHTML = '<p class="admin-access-msg">No reports yet. The spirits are behaving.</p>'
      return
    }

    content.innerHTML = `
      <p class="admin-count">${reports.length} report${reports.length !== 1 ? 's' : ''} filed</p>
      ${reports
        .map(
          (r) => `
        <div class="admin-report-card">
          <p><strong>Sighting ID:</strong> ${esc(r.id)}</p>
          <p><strong>Reason:</strong> ${esc(r.reason)}</p>
          <p><strong>Reported:</strong> ${esc(new Date(r.reportedAt).toLocaleString())}</p>
          <button class="admin-btn admin-btn--hide" data-id="${esc(r.id)}">Hide Sighting</button>
          <a href="/sighting.html?id=${encodeURIComponent(r.id)}" target="_blank" class="admin-preview-link">Preview story ↗</a>
        </div>`
        )
        .join('')}
    `

    content.addEventListener('click', async (e) => {
      const btn = e.target.closest('.admin-btn--hide')
      if (!btn || btn.disabled) return
      const sightingId = btn.dataset.id
      btn.disabled = true
      btn.textContent = 'Hiding…'

      try {
        // Pass key so the server-side guard accepts the request
        const res = await fetch(
          `/api/${encodeURIComponent(sightingId)}/hide?key=${encodeURIComponent(key)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hidden: true }),
          }
        )
        const data = await res.json()
        if (data.success) {
          btn.textContent = 'Hidden ✓'
          btn.classList.add('admin-btn--done')
        } else {
          btn.textContent = 'Error – try again'
          btn.disabled = false
        }
      } catch (err) {
        btn.textContent = 'Network error'
        btn.disabled = false
        console.error(err)
      }
    })
  } catch (err) {
    content.innerHTML = '<p class="admin-access-msg">Error loading reports.</p>'
    console.error(err)
  }
}
