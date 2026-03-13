(function () {
  // Dynamic import keeps this file usable as a plain (non-module) script
  // while still letting it access the analytics module.
  async function fireTrack(event, properties) {
    try {
      const { track } = await import('/analytics.js')
      track(event, properties)
    } catch {
      // Never block the newsletter UI
    }
  }

  document.querySelectorAll('.newsletter-form').forEach(function (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault()
      var emailInput = form.querySelector('.newsletter-email')
      var msgEl = form.parentElement.querySelector('.newsletter-msg')
      var email = emailInput ? emailInput.value.trim() : ''
      if (!email) return

      try {
        var res = await fetch('/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email }),
        })
        var data = await res.json()
        if (msgEl) {
          if (data.success) {
            // ── Analytics: newsletter signed up ─────────────
            fireTrack('newsletter_signed_up', {})
            msgEl.textContent = "You're in! Expect the eeriest tales in your inbox."
            form.reset()
          } else if (data.already) {
            msgEl.textContent = "You're already a member of our haunted mailing list."
          } else {
            msgEl.textContent = 'Something went wrong. Please try again.'
          }
        }
      } catch (err) {
        if (msgEl) msgEl.textContent = 'The server ghosted you. Try again shortly.'
        console.error(err)
      }
    })
  })
})()
