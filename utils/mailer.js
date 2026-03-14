import nodemailer from 'nodemailer'

const GMAIL_USER     = process.env.GMAIL_USER
const GMAIL_PASSWORD = process.env.GMAIL_APP_PASSWORD

function createTransport() {
  if (!GMAIL_USER || !GMAIL_PASSWORD) {
    throw new Error(
      'Email not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.'
    )
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASSWORD,
    },
  })
}

/**
 * Sends a new-story notification to a single subscriber.
 *
 * @param {object} opts
 * @param {string} opts.to           - Recipient email address
 * @param {string} opts.storyTitle   - Title of the new sighting
 * @param {string} opts.storyUrl     - Full URL to the sighting page
 * @param {string} opts.unsubscribeUrl - Full URL for one-click unsubscribe
 */
export async function sendStoryNotification({ to, storyTitle, storyUrl, unsubscribeUrl }) {
  const transport = createTransport()

  const subject = `New sighting: "${storyTitle}" – From the Other Side`

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#1a1a1a;color:#f0f0f0;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#252525;border-radius:8px;overflow:hidden;">
    <tr>
      <td style="background:#111;padding:24px;text-align:center;">
        <span style="font-size:22px;color:#fff;letter-spacing:1px;">From the Other Side</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 36px;">
        <p style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#888;margin:0 0 8px;">New sighting just posted</p>
        <h1 style="font-size:20px;color:#fff;margin:0 0 24px;line-height:1.4;">${escapeHtml(storyTitle)}</h1>
        <a href="${storyUrl}" style="display:inline-block;background:#fff;color:#111;padding:12px 28px;border-radius:5px;text-decoration:none;font-weight:bold;font-size:14px;">Read the Sighting</a>
        <p style="margin:32px 0 0;font-size:13px;color:#777;line-height:1.6;">
          You're receiving this because you joined the haunted mailing list at
          <a href="https://fromtheotherside.com" style="color:#aaa;">From the Other Side</a>.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 36px;border-top:1px solid #333;text-align:center;">
        <a href="${unsubscribeUrl}" style="font-size:11px;color:#555;text-decoration:underline;">Unsubscribe</a>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `New sighting on From the Other Side\n\n"${storyTitle}"\n\nRead it here: ${storyUrl}\n\n---\nUnsubscribe: ${unsubscribeUrl}`

  await transport.sendMail({
    from: `"From the Other Side" <${GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  })
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
