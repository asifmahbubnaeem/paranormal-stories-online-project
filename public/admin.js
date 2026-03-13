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

if (key !== 'ghostadmin') {
  content.innerHTML =
    '<p class="admin-access-msg">Restricted access. Add <code>?key=ghostadmin</code> to the URL.</p>'
} else {
  loadReports()
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
