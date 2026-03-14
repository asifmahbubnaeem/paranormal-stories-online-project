import { track } from '/analytics.js'

const form = document.getElementById('eventForm')
const formMessageText = document.getElementsByClassName('form-message-text')[0]
const uploadSuccess = document.getElementById('uploadSuccess')

// Pre-populate tag from URL param (e.g. arriving from a "similar sighting" CTA)
const preselectedTag = new URLSearchParams(window.location.search).get('tag')
if (preselectedTag) {
  const cb = document.querySelector(`input[name="tags"][value="${preselectedTag}"]`)
  if (cb) cb.checked = true
}

let successStoryUrl = null

form.addEventListener('submit', async function (event) {
  event.preventDefault()

  const location = document.getElementById('location').value.trim()
  const text = document.getElementById('details').value.trim()
  const title = document.getElementById('title').value.trim()
  const displayName = document.getElementById('displayName').value.trim()

  const tagCheckboxes = document.querySelectorAll('input[name="tags"]:checked')
  const tags = Array.from(tagCheckboxes).map((cb) => cb.value)

  if (!location || !text || !title) {
    formMessageText.textContent = 'Please complete all fields!'
    return
  }

  const isoDateString = document.getElementById('datetime').value
  if (!isoDateString) {
    formMessageText.textContent = 'Please select a date and time!'
    return
  }

  const date = new Date(isoDateString)
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
  const readableDate = date.toLocaleString('en-GB', options)

  const formData = {
    location,
    timeStamp: readableDate,
    text,
    title,
    ...(displayName && { displayName }),
    ...(tags.length > 0 && { tags }),
  }

  try {
    formMessageText.textContent = ''
    const response = await fetch('./api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    if (response.ok) {
      const saved = await response.json()
      const savedId = saved.id || saved.uuid
      const isApproved = saved.approved === true

      // ── Analytics: story submitted ─────────────────────────
      track('story_submitted', {
        tags,
        hasDisplayName: Boolean(displayName),
        id: savedId,
      })

      const successLink = document.getElementById('successStoryLink')
      const successTitle = document.getElementById('successTitle')
      const successSubtitle = document.getElementById('successSubtitle')
      const successPending = document.getElementById('successPending')
      if (isApproved && savedId) {
        successStoryUrl = `${window.location.origin}/sighting.html?id=${encodeURIComponent(savedId)}`
        successLink.href = successStoryUrl
        successLink.hidden = false
        if (successPending) successPending.hidden = true
        if (successTitle) successTitle.textContent = 'Your sighting is live! 👻'
        if (successSubtitle) successSubtitle.textContent = 'The spirits have received your account. Now let the world know.'
      } else {
        successLink.hidden = true
        if (successPending) successPending.hidden = false
        if (successTitle) successTitle.textContent = 'Submitted – awaiting approval 👻'
        if (successSubtitle) successSubtitle.textContent = 'Your story will be published once an admin approves it. Newsletter subscribers will be notified then.'
        document.querySelector('.upload-success-share-title')?.style.setProperty('display', 'none')
        document.getElementById('successShareButtons')?.style.setProperty('display', 'none')
      }

      form.style.display = 'none'
      if (uploadSuccess) uploadSuccess.hidden = false
    } else {
      formMessageText.textContent = 'The server Ghosted you(!). Please try again.'
      console.error('Server Error:', response.statusText)
    }
  } catch (error) {
    formMessageText.textContent = 'Serious ghouls! Please try again.'
    console.error('Error:', error)
  }
})

// Share buttons on success screen
document.getElementById('successShareButtons')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.share-btn')
  if (!btn) return
  const network = btn.getAttribute('data-network')
  const helper = document.getElementById('successShareHelper')
  const url = successStoryUrl || window.location.href
  const titleVal = document.getElementById('title')?.value || 'My ghost sighting on From the Other Side'

  // ── Analytics: story shared from success screen ────────────
  track('story_shared', { network, context: 'success_screen' })

  try {
    if (network === 'native' && navigator.share) {
      await navigator.share({ title: titleVal, url })
      if (helper) helper.textContent = 'Shared!'
      return
    }
    if (network === 'copy') {
      await navigator.clipboard.writeText(url)
      if (helper) helper.textContent = 'Link copied!'
      return
    }

    let shareLink = ''
    if (network === 'twitter')
      shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(titleVal)}&url=${encodeURIComponent(url)}`
    else if (network === 'reddit')
      shareLink = `https://www.reddit.com/submit?title=${encodeURIComponent(titleVal)}&url=${encodeURIComponent(url)}`
    else if (network === 'whatsapp')
      shareLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(titleVal + ' – ' + url)}`

    if (shareLink) {
      window.open(shareLink, '_blank', 'noopener')
      if (helper) helper.textContent = 'Opening…'
    }
  } catch (err) {
    console.error(err)
  }
})
