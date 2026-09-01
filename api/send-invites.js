import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
)
const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL    = 'Rod & Paean <noreply@rodandpae.com>'
const SITE_URL      = process.env.SITE_URL || 'https://www.rodandpae.com'
const CONTACT_EMAIL = 'rodgmz@gmail.com'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { recipients, testEmail, subject, body } = req.body
  if (!subject?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'Subject and body are required.' })
  }

  const { data: config } = await supabase.from('wedding_config').select('rsvp_deadline').eq('id', 1).single()
  const deadlineText = formatDeadline(config?.rsvp_deadline)

  const isTest = recipients === 'test'
  if (isTest && !testEmail?.trim()) {
    return res.status(400).json({ error: 'Test email address is required.' })
  }

  let toSend = []
  if (isTest) {
    toSend = [{ id: null, primary_guest_name: 'Guest', email: testEmail.trim() }]
  } else if (Array.isArray(recipients)) {
    // Specific emails selected from admin checkboxes
    const { data } = await supabase
      .from('guests')
      .select('id, primary_guest_name, email')
      .in('email', recipients)
    toSend = data || []
  } else {
    // Bulk modes: 'pending' or 'all'
    let query = supabase.from('guests').select('id, primary_guest_name, email').not('email', 'is', null).neq('email', '')
    if (recipients === 'pending') query = query.eq('rsvp_status', 'pending')
    const { data, error } = await query
    if (error) return res.status(500).json({ error: 'Could not fetch guests.' })
    toSend = data || []
  }

  let sent = 0, failed = 0
  const errors = []
  const sentIds = []

  for (const guest of toSend) {
    if (!guest.email) continue
    const firstName = guest.primary_guest_name?.split(' ')[0] || 'Guest'
    const rsvpUrl   = `${SITE_URL}/#rsvp?name=${encodeURIComponent(guest.primary_guest_name)}`
    try {
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to:   guest.email,
        subject,
        html: buildHtml({ firstName, body, rsvpUrl, deadlineText }),
      })
      if (error) { errors.push(`${guest.primary_guest_name}: ${error.message}`); failed++ }
      else { if (guest.id) sentIds.push(guest.id); sent++ }
    } catch (e) {
      errors.push(`${guest.primary_guest_name}: ${e.message}`)
      failed++
    }
  }

  if (sentIds.length > 0) {
    await supabase
      .from('guests')
      .update({ email_sent: true, email_sent_at: new Date().toISOString() })
      .in('id', sentIds)
  }

  return res.status(200).json({ sent, failed, errors })
}

function formatDeadline(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function buildHtml({ firstName, body, rsvpUrl, deadlineText }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rod &amp; Paean</title>
</head>
<body style="margin:0;padding:0;background:#0E0406;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F5;padding:48px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

  <tr>
    <td style="padding:0 0 40px;text-align:center;">
      <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:38px;font-weight:400;font-style:italic;color:#1A1A1A;letter-spacing:0.01em;">Rod &amp; Paean</h1>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#9A8A7A;letter-spacing:0.18em;text-transform:uppercase;">March 27, 2027 &nbsp;&middot;&nbsp; Laguna Beach, CA</p>
    </td>
  </tr>

  <tr>
    <td style="background:#FFFFFF;border-radius:20px;border:1px solid #E8E0D8;padding:48px 52px;">
      <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:16px;color:#1A1A1A;line-height:1.8;">Dear ${firstName},</p>
      <p style="margin:0;font-family:Georgia,serif;font-size:16px;color:#2C2C2C;line-height:1.9;">${body.replace(/\n/g, '<br>')}</p>

      <table cellpadding="0" cellspacing="0" style="margin:40px auto 0;">
        <tr><td align="center" style="background:#C46420;border-radius:100px;">
          <a href="${rsvpUrl}" style="display:block;padding:15px 48px;color:white;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">RSVP Now</a>
        </td></tr>
      </table>

      ${deadlineText ? `<p style="margin:36px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#9A8A7A;line-height:1.7;font-style:italic;text-align:center;">
        Kindly respond by ${deadlineText}.
      </p>` : ''}
    </td>
  </tr>

  <tr>
    <td style="padding:28px 0;text-align:center;">
      <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:13px;color:#9A8A7A;font-style:italic;">With love — Rod &amp; Paean</p>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#B0A090;">
        Questions? <a href="mailto:${CONTACT_EMAIL}" style="color:#C46420;text-decoration:none;">${CONTACT_EMAIL}</a>
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
