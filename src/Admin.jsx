import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import {
  Upload, LogOut, Pencil, Trash2, Plus, Download, Search,
  Send, X, Check, RefreshCw, Lock, Unlock, Mail, ChevronDown, CornerDownRight,
} from 'lucide-react'
import { getAllGuests, insertGuests, updateGuestField, deleteGuest, deleteGuests, getConfig, updateConfig } from './lib/supabase.js'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

// ─── CSV helpers ──────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ }
    else if (line[i] === ',' && !inQ) { result.push(cur); cur = '' }
    else cur += line[i]
  }
  result.push(cur)
  return result
}

function parseCSVText(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).filter(l => l.trim()).map((line, i) => {
    const values = parseCSVLine(line)
    const obj = { _id: `${i}_${Date.now()}` }
    headers.forEach((h, j) => { obj[h.trim()] = (values[j] ?? '').trim() })
    const plusOne    = obj.plus_one_name || ''
    const additional = (obj.additional_guests || '').split(',').map(s => s.trim()).filter(Boolean)
    obj.party_members = [plusOne, ...additional].filter(Boolean).map(name => ({ name }))
    // Normalise rsvp → rsvp_status
    obj.rsvp_status = obj.rsvp || 'pending'
    return obj
  })
}

// Splits any party member whose name contains commas (bad data, or a pasted list) into separate members.
// An unnamed plus-one (needsName: true) is passed through untouched — it has no name to split yet.
function splitPartyMembers(members) {
  return (members || []).flatMap(m => {
    if (m.needsName) return [m]
    return (m.name || '').split(',').map(s => s.trim()).filter(Boolean).map(name => ({ ...m, name }))
  })
}

function toCSV(guests) {
  const cols = ['household_name', 'primary_guest_name', 'salutation', 'plus_one_name', 'max_guests_allotted', 'email', 'rsvp_status', 'primary_meal_choice', 'dietary_restrictions']
  const esc  = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = guests.map(g => cols.map(c => esc(c === 'rsvp' && !g.rsvp ? 'pending' : (g[c] ?? ''))).join(','))
  return [cols.join(','), ...rows].join('\n')
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-2xl p-5 border ${accent ? 'bg-primary/5 border-primary/20' : 'bg-surface border-divider'}`}>
      <p className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted mb-1">{label}</p>
      <p className={`font-serif text-3xl leading-none mb-1 ${accent ? 'text-primary' : 'text-ink'}`}>{value}</p>
      {sub && <p className="font-body text-xs text-muted/60">{sub}</p>}
    </div>
  )
}

function RSVPSelect({ value, onChange }) {
  const color = value === 'attending' ? '#34d399' : value === 'declined' ? '#f87171' : 'rgba(255,255,255,0.3)'
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{ color, borderColor: 'rgba(196,100,32,0.25)', background: 'rgba(58,14,24,0.72)' }}
      className="rounded-lg px-3 py-1.5 font-subheading text-[10px] uppercase tracking-[0.15em] focus:outline-none transition-colors cursor-pointer"
    >
      <option value="">Pending</option>
      <option value="attending">Attending</option>
      <option value="declined">Declined</option>
    </select>
  )
}

function RSVPBadge({ value }) {
  const color = value === 'attending' ? '#34d399' : value === 'declined' ? '#f87171' : 'rgba(255,255,255,0.4)'
  const label = value === 'attending' ? 'Attending' : value === 'declined' ? 'Declined' : 'Pending'
  return <span style={{ color }} className="font-subheading text-[10px] uppercase tracking-[0.15em]">{label}</span>
}

// attending is tri-state: true = attending, false = declined, null/undefined = pending
function memberStatus(member) {
  if (member.attending === true) return 'attending'
  if (member.attending === false) return 'declined'
  return 'pending'
}

function GuestRow({ name, attending, meal, rsvpStatus, secondary }) {
  const isPending = rsvpStatus === 'pending' || !rsvpStatus
  return (
    <div className="flex items-center gap-1.5">
      {isPending ? (
        <span className="h-3 w-3 shrink-0" />
      ) : attending ? (
        <Check className="h-3 w-3 text-emerald-400 shrink-0" strokeWidth={2.5} />
      ) : (
        <X className="h-3 w-3 text-muted/40 shrink-0" strokeWidth={2.2} />
      )}
      <span className={`font-body text-xs truncate ${secondary ? 'text-muted' : 'text-ink'}`}>{name}</span>
      {attending && meal && (
        <span className="font-mono text-[9px] text-muted capitalize bg-surface-2 px-1.5 py-0.5 rounded shrink-0">{meal}</span>
      )}
    </div>
  )
}

function SalutationSelect({ value, onChange }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{ borderColor: 'rgba(196,100,32,0.25)', background: 'rgba(58,14,24,0.72)', color: value ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)' }}
      className="rounded-lg px-2 py-1.5 font-subheading text-[10px] uppercase tracking-[0.15em] focus:outline-none transition-colors cursor-pointer w-full"
    >
      <option value="">—</option>
      <option value="Mr.">Mr.</option>
      <option value="Ms.">Ms.</option>
      <option value="Mrs.">Mrs.</option>
      <option value="Dr.">Dr.</option>
    </select>
  )
}

function MealSelect({ value, onChange, className = '' }) {
  const labels = { beef: 'Beef', fish: 'Fish', vegetarian: 'Veg' }
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{ borderColor: 'rgba(196,100,32,0.25)', background: 'rgba(58,14,24,0.72)', color: value ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)' }}
      className={`rounded-lg px-3 py-1.5 font-subheading text-[10px] uppercase tracking-[0.15em] focus:outline-none transition-colors cursor-pointer ${className}`}
    >
      <option value="">—</option>
      <option value="beef">Beef</option>
      <option value="fish">Fish</option>
      <option value="vegetarian">Veg</option>
    </select>
  )
}

function MemberRSVPSelect({ attending, onChange, className = '' }) {
  const value = attending === true ? 'attending' : attending === false ? 'declined' : 'pending'
  const color = value === 'attending' ? '#34d399' : value === 'declined' ? '#f87171' : 'rgba(255,255,255,0.4)'
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value === 'pending' ? null : e.target.value === 'attending')}
      style={{ color, borderColor: 'rgba(196,100,32,0.25)', background: 'rgba(58,14,24,0.72)' }}
      className={`rounded-lg px-2 py-1 font-subheading text-[9px] uppercase tracking-[0.15em] focus:outline-none transition-colors cursor-pointer ${className}`}
    >
      <option value="pending">Pending</option>
      <option value="attending">Attending</option>
      <option value="declined">Declined</option>
    </select>
  )
}

function Checkbox({ checked, indeterminate, onChange }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate }, [indeterminate])
  return (
    <input ref={ref} type="checkbox" checked={checked}
      onChange={e => onChange(e.target.checked)}
      className="h-3.5 w-3.5 rounded cursor-pointer accent-primary" />
  )
}

// ─── Email modal ──────────────────────────────────────────────────────────────
const RECIPIENT_FILTERS = ['all', 'attending', 'declined', 'pending']

function formatDeadline(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function EmailModal({ guests, rsvpDeadline, onClose }) {
  const [step, setStep]           = useState('recipients')
  const [subject, setSubject]     = useState("You're invited — Rod & Paean, March 27, 2027")
  const [body, setBody]           = useState("We would be so honored to celebrate our wedding day with you. We've reserved a place in your name.")
  const [testEmail, setTestEmail] = useState('')
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')

  const withEmailGuests = useMemo(() => guests.filter(g => g.email), [guests])

  const [recipientIds, setRecipientIds] = useState(() => new Set())
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientFilter, setRecipientFilter] = useState('all')

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])

  const toggleRecipient = (id) => setRecipientIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const visibleRecipients = useMemo(() => {
    const q = recipientSearch.toLowerCase()
    return withEmailGuests.filter(g => {
      const matchSearch = !q || g.primary_guest_name?.toLowerCase().includes(q) || g.email?.toLowerCase().includes(q)
      const matchFilter = recipientFilter === 'all' || g.rsvp_status === recipientFilter || (recipientFilter === 'pending' && !g.rsvp_status)
      return matchSearch && matchFilter
    })
  }, [withEmailGuests, recipientSearch, recipientFilter])

  const allVisRecipientsChecked  = visibleRecipients.length > 0 && visibleRecipients.every(g => recipientIds.has(g._id))
  const someVisRecipientsChecked = visibleRecipients.some(g => recipientIds.has(g._id)) && !allVisRecipientsChecked
  const toggleAllRecipients = (checked) => setRecipientIds(prev => {
    const n = new Set(prev)
    visibleRecipients.forEach(g => checked ? n.add(g._id) : n.delete(g._id))
    return n
  })

  const withEmail = useMemo(() => guests.filter(g => recipientIds.has(g._id)), [guests, recipientIds])

  const send = async (isTest = false) => {
    setError('')
    if (!subject.trim()) { setError('Subject is required.'); return }
    if (isTest && !testEmail.trim()) { setError('Enter an email for the test.'); return }
    setStep('sending')
    try {
      const res = await fetch('/api/send-invites', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PASSWORD },
        body:    JSON.stringify({
          recipients: isTest ? 'test' : withEmail.map(g => g.email),
          testEmail:  isTest ? testEmail : undefined,
          subject, body,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setStep('compose'); return }
      setResult({ ...data, isTest })
      setStep('done')
    } catch (e) {
      setError(e.message)
      setStep('compose')
    }
  }

  const previewName = withEmail[0]?.primary_guest_name?.split(' ')[0] || 'Guest'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-surface rounded-3xl shadow-2xl border border-divider overflow-hidden flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-divider shrink-0">
          <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-muted">
            {step === 'sending'    ? 'Sending…'
              : step === 'done'    ? (result?.isTest ? 'Test sent' : 'Invitations sent')
              : step === 'recipients' ? 'Choose Recipients'
              : 'Compose Email'}
          </p>
          {step !== 'sending' && <button onClick={onClose}><X className="h-4 w-4 text-muted hover:text-ink transition-colors" /></button>}
        </div>

        <div className="px-7 py-6 overflow-y-auto flex-1 min-h-0 space-y-5">

          {step === 'sending' && (
            <div className="py-12 text-center">
              <RefreshCw className="h-7 w-7 text-primary animate-spin mx-auto mb-4" />
              <p className="font-body text-sm text-muted">Sending invitations…</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-5">
              {result.isTest ? (
                <div className="flex items-start gap-3 bg-emerald-900/20 border border-emerald-500/20 rounded-2xl px-5 py-4">
                  <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" strokeWidth={2.5} />
                  <p className="font-body text-sm text-ink">Test email sent to <strong>{testEmail}</strong>. Check your inbox before sending to guests.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.sent > 0 && (
                    <div className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" strokeWidth={2.5} />
                      <span className="font-body text-sm text-ink"><strong>{result.sent}</strong> invitation{result.sent !== 1 ? 's' : ''} sent</span>
                    </div>
                  )}
                  {result.failed > 0 && (
                    <div className="flex items-center gap-3">
                      <X className="h-4 w-4 text-rose-400 shrink-0" />
                      <span className="font-body text-sm text-muted"><strong>{result.failed}</strong> failed</span>
                    </div>
                  )}
                </div>
              )}
              <button onClick={result.isTest ? () => setStep('compose') : onClose}
                className="w-full btn-amber-gradient text-white py-3 rounded-2xl font-subheading font-semibold text-sm">
                {result.isTest ? '← Back to compose' : 'Done'}
              </button>
            </div>
          )}

          {step === 'recipients' && (
            <>
              {withEmailGuests.length === 0 ? (
                <p className="font-body text-xs text-amber-400">No guests have email addresses on file.</p>
              ) : (
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div className="flex items-center gap-2 bg-surface-2 border border-divider rounded-full px-4 py-2 flex-1 min-w-[160px]">
                      <Search className="h-3.5 w-3.5 text-muted shrink-0" />
                      <input value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} placeholder="Search guests…"
                        className="bg-transparent font-body text-xs text-ink placeholder:text-muted/40 focus:outline-none w-full" />
                    </div>
                    <div className="flex items-center gap-1 bg-surface-2 border border-divider rounded-full px-2 py-1.5">
                      {RECIPIENT_FILTERS.map(f => (
                        <button key={f} onClick={() => setRecipientFilter(f)}
                          className={`px-3 py-1 rounded-full font-subheading text-[9px] uppercase tracking-[0.15em] transition-colors ${recipientFilter === f ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="border border-divider rounded-2xl overflow-hidden">
                    <div className="max-h-[22rem] overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-surface border-b border-divider">
                          <tr>
                            <th className="px-4 py-2.5 w-10 text-left">
                              <Checkbox checked={allVisRecipientsChecked} indeterminate={someVisRecipientsChecked} onChange={toggleAllRecipients} />
                            </th>
                            <th className="px-2 py-2.5 text-left font-subheading text-[9px] uppercase tracking-[0.15em] text-muted">Name</th>
                            <th className="px-2 py-2.5 text-left font-subheading text-[9px] uppercase tracking-[0.15em] text-muted">Email</th>
                            <th className="px-4 py-2.5 text-left font-subheading text-[9px] uppercase tracking-[0.15em] text-muted">RSVP</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-divider/50">
                          {visibleRecipients.length === 0 ? (
                            <tr><td colSpan={4} className="px-4 py-8 text-center font-body text-xs text-muted/40">No matches</td></tr>
                          ) : visibleRecipients.map(g => (
                            <tr key={g._id} onClick={() => toggleRecipient(g._id)}
                              className={`cursor-pointer transition-colors ${recipientIds.has(g._id) ? 'bg-primary/5' : 'hover:bg-surface-2/30'}`}>
                              <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                                <Checkbox checked={recipientIds.has(g._id)} onChange={() => toggleRecipient(g._id)} />
                              </td>
                              <td className="px-2 py-2.5 font-body text-xs text-ink truncate max-w-[140px]">{g.primary_guest_name}</td>
                              <td className="px-2 py-2.5 font-body text-xs text-muted truncate max-w-[180px]">{g.email}</td>
                              <td className="px-4 py-2.5"><RSVPBadge value={g.rsvp_status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="font-body text-xs text-muted/50 mt-2">{withEmail.length} of {withEmailGuests.length} selected</p>
                </div>
              )}
            </>
          )}

          {step === 'compose' && (
            <>
              <button type="button" onClick={() => setStep('recipients')}
                className="w-full flex items-center justify-between bg-surface-2 border border-divider rounded-2xl px-5 py-3.5 hover:border-primary/30 transition-colors text-left">
                <span className="font-body text-sm text-ink">
                  Sending to <strong>{withEmail.length}</strong> guest{withEmail.length !== 1 ? 's' : ''}
                </span>
                <span className="font-subheading text-[9px] uppercase tracking-[0.15em] text-primary">Edit</span>
              </button>

              <div>
                <p className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted mb-2">Subject line</p>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full bg-surface-2 border border-divider rounded-xl px-4 py-3 font-body text-sm text-ink placeholder:text-muted/40 focus:outline-none focus:border-primary/40 transition-colors" />
              </div>

              <div>
                <p className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted mb-2">Message body</p>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
                  className="w-full bg-surface-2 border border-divider rounded-xl px-4 py-3 font-body text-sm text-ink placeholder:text-muted/40 focus:outline-none focus:border-primary/40 transition-colors resize-none" />
              </div>

              {/* Preview */}
              <div className="bg-surface-2 border border-divider rounded-2xl px-5 py-4">
                <p className="font-subheading text-[9px] uppercase tracking-[0.18em] text-muted mb-3">Preview</p>
                <div className="space-y-1 mb-3">
                  <p className="font-body text-xs text-muted"><span className="text-ink font-medium">From:</span> Rod &amp; Paean &lt;noreply@rodandpae.com&gt;</p>
                  <p className="font-body text-xs text-muted"><span className="text-ink font-medium">Subject:</span> {subject || '—'}</p>
                </div>
                <div className="border-t border-divider pt-3">
                  <p className="font-body text-sm text-ink mb-1">Dear {previewName},</p>
                  <p className="font-body text-xs text-muted line-clamp-2">{body}</p>
                  <div className="mt-2.5">
                    <span className="inline-block bg-primary text-white font-body text-xs font-semibold px-4 py-1.5 rounded-full">RSVP Now</span>
                  </div>
                  {formatDeadline(rsvpDeadline) && (
                    <p className="font-body text-xs text-muted/70 italic mt-3">Kindly respond by {formatDeadline(rsvpDeadline)}.</p>
                  )}
                </div>
              </div>

              {/* Test send */}
              <div>
                <p className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted mb-2">Send a test first (recommended)</p>
                <div className="flex gap-2">
                  <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 bg-surface-2 border border-divider rounded-xl px-4 py-2.5 font-body text-sm text-ink placeholder:text-muted/40 focus:outline-none focus:border-primary/40 transition-colors" />
                  <button type="button" onClick={() => send(true)} disabled={!testEmail.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-divider font-body text-sm text-muted hover:text-ink transition-colors disabled:opacity-40 shrink-0">
                    <Send className="h-3.5 w-3.5" /> Test
                  </button>
                </div>
              </div>

              {error && <p className="font-body text-xs text-rose-400">{error}</p>}
            </>
          )}
        </div>

        {step === 'recipients' && (
          <div className="px-7 py-5 border-t border-divider shrink-0 flex items-center justify-between gap-3">
            <button onClick={onClose} className="font-body text-sm text-muted hover:text-ink transition-colors">Cancel</button>
            <button onClick={() => setStep('compose')} disabled={withEmail.length === 0}
              className="inline-flex items-center gap-2 btn-amber-gradient text-white px-6 py-3 rounded-2xl font-subheading font-semibold text-sm disabled:opacity-40">
              Continue with {withEmail.length} guest{withEmail.length !== 1 ? 's' : ''} →
            </button>
          </div>
        )}

        {step === 'compose' && (
          <div className="px-7 py-5 border-t border-divider shrink-0 flex items-center justify-between gap-3">
            <button onClick={() => setStep('recipients')} className="font-body text-sm text-muted hover:text-ink transition-colors">← Back</button>
            <button onClick={() => send(false)} disabled={withEmail.length === 0}
              className="inline-flex items-center gap-2 btn-amber-gradient text-white px-6 py-3 rounded-2xl font-subheading font-semibold text-sm disabled:opacity-40">
              <Mail className="h-3.5 w-3.5" />
              Send to {withEmail.length} guest{withEmail.length !== 1 ? 's' : ''} →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Import modal ─────────────────────────────────────────────────────────────
function ImportModal({ guests, onClose, onDone }) {
  const [step, setStep]             = useState('upload')
  const [parsedRows, setParsedRows] = useState([])
  const [conflicts, setConflicts]   = useState([])
  const [actions, setActions]       = useState({})
  const [result, setResult]         = useState(null)
  const [dragOver, setDragOver]     = useState(false)
  const [parseError, setParseError] = useState('')
  const [importError, setImportError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])

  const handleFile = (file) => {
    if (!file) return
    setParseError('')
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSVText(ev.target.result)
      if (rows.length === 0) { setParseError('No valid rows found — check your column headers.'); return }
      setParsedRows(rows)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  const proceed = () => {
    const existingMap = new Map(guests.map(g => [g.primary_guest_name?.toLowerCase().trim(), g]))
    const found = parsedRows
      .filter(r => existingMap.has(r.primary_guest_name?.toLowerCase().trim()))
      .map(r => ({ parsed: r, existing: existingMap.get(r.primary_guest_name.toLowerCase().trim()) }))
    if (found.length > 0) {
      setConflicts(found)
      const defaults = {}
      found.forEach(c => { defaults[c.parsed.primary_guest_name.toLowerCase()] = 'skip' })
      setActions(defaults)
      setStep('conflicts')
    } else {
      runImport({})
    }
  }

  const runImport = async (resolvedActions) => {
    setStep('importing')
    const existingMap = new Map(guests.map(g => [g.primary_guest_name?.toLowerCase().trim(), g]))
    const toAdd = [], toOverwrite = []
    let skipped = 0
    for (const row of parsedRows) {
      const key = row.primary_guest_name?.toLowerCase().trim()
      if (existingMap.has(key)) {
        if ((resolvedActions[key] || 'skip') === 'overwrite') toOverwrite.push({ ...row, id: existingMap.get(key).id })
        else skipped++
      } else {
        toAdd.push(row)
      }
    }
    const toSupabase = r => ({
      household_name:      r.household_name,
      primary_guest_name:  r.primary_guest_name,
      salutation:          r.salutation || null,
      plus_one_name:       r.plus_one_name || null,
      party_members:       r.party_members || [],
      max_guests_allotted: parseInt(r.max_guests_allotted) || 1,
      email:               r.email || null,
      rsvp_status:         r.rsvp_status || 'pending',
    })
    let inserted = 0, updated = 0
    setImportError('')
    if (toAdd.length > 0) {
      const { data, error } = await insertGuests(toAdd.map(toSupabase))
      if (error) {
        setImportError(`Insert failed: ${error.message}`)
        setStep('preview')
        return
      }
      inserted = data?.length || toAdd.length
    }
    for (const row of toOverwrite) {
      if (row.id) {
        await updateGuestField(row.id, 'household_name', row.household_name)
        await updateGuestField(row.id, 'email', row.email || null)
        await updateGuestField(row.id, 'max_guests_allotted', parseInt(row.max_guests_allotted) || 1)
        updated++
      }
    }
    setResult({ inserted, updated, skipped })
    setStep('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-surface rounded-3xl shadow-2xl border border-divider overflow-hidden flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-divider shrink-0">
          <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-muted">
            {step === 'upload'    && 'Import Guest List'}
            {step === 'preview'   && `Preview — ${parsedRows.length} guests found`}
            {step === 'conflicts' && `${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''} found`}
            {step === 'done'      && 'Import complete'}
          </p>
          <button onClick={onClose}><X className="h-4 w-4 text-muted hover:text-ink transition-colors" /></button>
        </div>

        <div className="px-7 py-6 overflow-y-auto flex-1 min-h-0 space-y-5">

          {step === 'upload' && (
            <div className="space-y-5">
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl py-14 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-divider hover:border-primary/40 hover:bg-surface-2/20'
                }`}
              >
                <Upload className="h-7 w-7 text-muted mx-auto mb-3" strokeWidth={1.5} />
                <p className="font-body text-sm text-ink font-medium mb-1">Drop your CSV here</p>
                <p className="font-body text-xs text-muted">or click to browse</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
              </div>
              {parseError && <p className="font-body text-xs text-rose-400">{parseError}</p>}
              <div className="bg-surface-2 rounded-2xl px-5 py-4 border border-divider">
                <p className="font-subheading text-[9px] uppercase tracking-[0.18em] text-muted mb-2.5">Expected columns</p>
                <div className="flex flex-wrap gap-2">
                  {['household_name', 'salutation', 'primary_guest_name', 'plus_one_name', 'additional_guests', 'max_guests_allotted', 'email'].map(c => (
                    <code key={c} className="font-mono text-xs bg-divider px-2 py-0.5 rounded text-muted">{c}</code>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-divider overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-surface border-b border-divider">
                      <tr>
                        {['Household', 'Primary Guest', 'Party Members', 'Seats', 'Email'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 font-subheading text-[9px] uppercase tracking-[0.15em] text-muted whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider/50">
                      {parsedRows.map((r, i) => (
                        <tr key={i} className="hover:bg-surface-2/30">
                          <td className="px-4 py-2.5 font-body text-xs text-ink">{r.household_name}</td>
                          <td className="px-4 py-2.5 font-body text-xs text-ink font-medium">{r.primary_guest_name}</td>
                          <td className="px-4 py-2.5 font-body text-xs text-muted">{r.party_members?.map(m => m.name).join(', ') || '—'}</td>
                          <td className="px-4 py-2.5 font-body text-xs text-muted">{r.max_guests_allotted || 1}</td>
                          <td className="px-4 py-2.5 font-body text-xs text-muted">{r.email || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {importError && (
                <div className="bg-rose-900/20 border border-rose-500/20 rounded-xl px-4 py-3">
                  <p className="font-body text-xs text-rose-400">{importError}</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <button onClick={() => setStep('upload')} className="font-body text-sm text-muted hover:text-ink transition-colors">← Back</button>
                <button onClick={proceed} className="inline-flex items-center gap-2 btn-amber-gradient text-white px-6 py-3 rounded-2xl font-subheading font-semibold text-sm">
                  Import {parsedRows.length} guests →
                </button>
              </div>
            </div>
          )}

          {step === 'conflicts' && (
            <div className="space-y-4">
              <p className="font-body text-sm text-muted">These guests already exist. Overwriting updates their details but keeps any existing RSVP.</p>
              <div className="flex gap-2">
                <button onClick={() => { const a = {}; conflicts.forEach(c => { a[c.parsed.primary_guest_name.toLowerCase()] = 'skip' }); setActions(a) }}
                  className="font-body text-xs px-3 py-1.5 rounded-full border border-divider text-muted hover:text-ink transition-colors">Skip All</button>
                <button onClick={() => { const a = {}; conflicts.forEach(c => { a[c.parsed.primary_guest_name.toLowerCase()] = 'overwrite' }); setActions(a) }}
                  className="font-body text-xs px-3 py-1.5 rounded-full border border-divider text-muted hover:text-ink transition-colors">Overwrite All</button>
              </div>
              <div className="rounded-2xl border border-divider divide-y divide-divider overflow-hidden">
                {conflicts.map(c => {
                  const key    = c.parsed.primary_guest_name.toLowerCase()
                  const action = actions[key] || 'skip'
                  return (
                    <div key={key} className="flex items-center justify-between px-5 py-3.5">
                      <div>
                        <p className="font-body text-sm font-medium text-ink">{c.parsed.primary_guest_name}</p>
                        <p className="font-body text-xs text-muted mt-0.5">{c.parsed.household_name}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {['skip', 'overwrite'].map(a => (
                          <button key={a} onClick={() => setActions(prev => ({ ...prev, [key]: a }))}
                            className={`font-body text-xs px-3 py-1.5 rounded-full capitalize transition-colors ${
                              action === a ? 'bg-primary text-white font-medium' : 'border border-divider text-muted hover:text-ink'
                            }`}>{a}</button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => setStep('preview')} className="font-body text-sm text-muted hover:text-ink transition-colors">← Back</button>
                <button onClick={() => runImport(actions)} className="inline-flex items-center gap-2 btn-amber-gradient text-white px-6 py-3 rounded-2xl font-subheading font-semibold text-sm">
                  Confirm import →
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 text-center">
              <RefreshCw className="h-7 w-7 text-primary animate-spin mx-auto mb-4" />
              <p className="font-body text-sm text-muted">Saving to Supabase…</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-4">
              {result.inserted > 0 && (
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" strokeWidth={2.5} />
                  <span className="font-body text-sm text-ink"><strong>{result.inserted}</strong> guest{result.inserted !== 1 ? 's' : ''} added</span>
                </div>
              )}
              {result.updated > 0 && (
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" strokeWidth={2.5} />
                  <span className="font-body text-sm text-ink"><strong>{result.updated}</strong> guest{result.updated !== 1 ? 's' : ''} updated</span>
                </div>
              )}
              {result.skipped > 0 && (
                <div className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-center font-mono text-xs text-muted">—</span>
                  <span className="font-body text-sm text-muted"><strong>{result.skipped}</strong> skipped</span>
                </div>
              )}
              <button onClick={onDone} className="w-full btn-amber-gradient text-white py-3 rounded-2xl font-subheading font-semibold text-sm">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Filters ──────────────────────────────────────────────────────────────────
const FILTERS = ['all', 'attending', 'declined', 'pending']

// ─── Admin ────────────────────────────────────────────────────────────────────
export default function Admin() {
  const [authed, setAuthed]         = useState(() => sessionStorage.getItem('admin_authed') === '1')
  const [pw, setPw]                 = useState('')
  const [pwError, setPwError]       = useState(false)
  const [guests, setGuests]         = useState([])
  const [loading, setLoading]       = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('all')
  const [selected, setSelected]     = useState(new Set())
  const [showEmail, setShowEmail]   = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [rsvpLocked, setRsvpLocked]     = useState(false)
  const [rsvpDeadline, setRsvpDeadline] = useState('')
  const [configError, setConfigError]   = useState('')
  const [expandedParty, setExpandedParty] = useState(new Set())
  const toggleParty = (id) => setExpandedParty(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const login  = () => {
    if (pw === ADMIN_PASSWORD) { sessionStorage.setItem('admin_authed', '1'); setAuthed(true); setPwError(false) }
    else setPwError(true)
  }
  const logout = () => { sessionStorage.removeItem('admin_authed'); setAuthed(false) }

  const loadGuests = async () => {
    setLoading(true); setFetchError(null)
    const { data, error } = await getAllGuests()
    setLoading(false)
    if (error) { setFetchError('Could not load guest list from Supabase.'); return }
    const normalized = (data || []).map(g => ({ ...g, _id: g.id, party_members: splitPartyMembers(g.party_members) }))
    setGuests(normalized)
    normalized.forEach((g, i) => {
      if (g.party_members.length !== (data[i].party_members || []).length) {
        updateGuestField(g.id, 'party_members', g.party_members)
      }
    })
  }

  const loadConfig = async () => {
    const data = await getConfig()
    if (data?.rsvp_deadline) setRsvpDeadline(data.rsvp_deadline)
    setRsvpLocked(!!data?.rsvp_locked)
  }

  useEffect(() => { if (authed) { loadGuests(); loadConfig() } }, [authed])

  const saveDeadline = async (value) => {
    const previous = rsvpDeadline
    setRsvpDeadline(value)
    const { error } = await updateConfig({ rsvp_deadline: value })
    if (error) { setRsvpDeadline(previous); setConfigError('Could not save RSVP deadline.') }
    else setConfigError('')
  }

  const toggleLock = async () => {
    const previous = rsvpLocked
    const next = !previous
    setRsvpLocked(next)
    const { error } = await updateConfig({ rsvp_locked: next })
    if (error) { setRsvpLocked(previous); setConfigError('Could not save RSVP lock.') }
    else setConfigError('')
  }

  const blankEdit = {
    household_name: '', salutation: '', primary_guest_name: '', party_members: [],
    max_guests_allotted: 1, email: '', rsvp_status: 'pending', primary_meal_choice: '', dietary_restrictions: '',
  }
  const [editingId, setEditingId] = useState(null)
  const [edit, setEdit]           = useState(blankEdit)

  const setEditField = (field, value) => setEdit(e => ({ ...e, [field]: value }))
  // Adding/removing a party member always keeps Seats in sync with the actual party size.
  const setEditPartyMembers = (members) => setEdit(e => ({ ...e, party_members: members, max_guests_allotted: members.length + 1 }))

  const startEdit = (g) => {
    setEditingId(g._id)
    setEdit({
      household_name:       g.household_name || '',
      salutation:           g.salutation || '',
      primary_guest_name:   g.primary_guest_name || '',
      party_members:        (g.party_members || []).map(m => ({ ...m })),
      max_guests_allotted:  g.max_guests_allotted || 1,
      email:                g.email || '',
      rsvp_status:          g.rsvp_status || 'pending',
      primary_meal_choice:  g.primary_meal_choice || '',
      dietary_restrictions: g.dietary_restrictions || '',
    })
  }
  const stopEditing = () => { setEditingId(null); setEdit(blankEdit) }
  const cancelEdit = () => {
    // A row added via "Add Row" has no id yet (not saved to Supabase) — cancelling it
    // should discard the blank row rather than leave a ghost entry in the table.
    const guest = guests.find(g => g._id === editingId)
    if (guest && guest.id === null) {
      setGuests(gs => gs.filter(g => g._id !== editingId))
    }
    stopEditing()
  }
  const saveEdit = async () => {
    if (!edit.primary_guest_name.trim()) return
    const guest = guests.find(g => g._id === editingId)
    if (!guest) return
    const cleanedParty = edit.party_members.filter(m => m.name.trim() || m.needsName).map(m => ({ ...m, name: m.name.trim() }))
    const isAttending = edit.rsvp_status === 'attending'
    const cleaned = {
      ...edit,
      primary_guest_name: edit.primary_guest_name.trim(),
      party_members: cleanedParty,
      // Seats can never be fewer than the named party — grows automatically as members are added.
      max_guests_allotted: Math.max(parseInt(edit.max_guests_allotted) || 1, 1 + cleanedParty.length),
      // Confirmed count is derived from RSVP status + who's individually marked attending, not left stale.
      primary_attending: isAttending,
      num_attending: isAttending ? 1 + cleanedParty.filter(m => m.attending).length : 0,
      // '' fails the DB check constraints on these columns (only null or a real value is allowed).
      salutation:           edit.salutation || null,
      primary_meal_choice:  edit.primary_meal_choice || null,
      dietary_restrictions: edit.dietary_restrictions || null,
      email:                edit.email || null,
    }
    if (guest.id) {
      setGuests(gs => gs.map(g => g._id === editingId ? { ...g, ...cleaned } : g))
      await Promise.all(Object.entries(cleaned).map(([field, value]) => updateGuestField(guest.id, field, value)))
    } else {
      // Brand-new row from "Add Row" — not in Supabase yet, so insert it rather than
      // just updating local state (which cancelEdit would then discard as unsaved).
      const { data, error } = await insertGuests([cleaned])
      if (error || !data?.[0]) return
      setGuests(gs => gs.map(g => g._id === editingId ? { ...data[0], _id: g._id } : g))
    }
    stopEditing()
  }

  const removeGuest = async (id) => {
    setGuests(gs => gs.filter(g => g._id !== id))
    setSelected(s => { const n = new Set(s); n.delete(id); return n })
    const guest = guests.find(g => g._id === id)
    if (guest?.id) await deleteGuest(guest.id)
  }

  const deleteSelected = async () => {
    if (!window.confirm(`Delete ${selected.size} guest${selected.size !== 1 ? 's' : ''}? This can't be undone.`)) return
    const ids = guests.filter(g => selected.has(g._id) && g.id).map(g => g.id)
    setGuests(gs => gs.filter(g => !selected.has(g._id)))
    setSelected(new Set())
    if (ids.length > 0) await deleteGuests(ids)
  }

  const addGuest = () => {
    const newGuest = {
      _id: `local_${Date.now()}`, id: null,
      household_name: '', primary_guest_name: '',
      max_guests_allotted: 1, email: '', rsvp_status: 'pending', party_members: [],
    }
    setGuests(gs => [...gs, newGuest])
    startEdit(newGuest)
  }

  const stats = useMemo(() => {
    const attending = guests.filter(g => g.rsvp_status === 'attending')
    const allMeals  = attending.flatMap(g => [
      g.primary_meal_choice,
      ...(g.party_members || []).map(m => m.meal_choice),
    ]).filter(Boolean)
    return {
      households:     guests.length,
      seatsInvited:   guests.reduce((s, g) => s + (parseInt(g.max_guests_allotted) || 1), 0),
      seatsConfirmed: guests.reduce((s, g) => s + (parseInt(g.num_attending) || 0), 0),
      attending:  attending.length,
      declined:   guests.filter(g => g.rsvp_status === 'declined').length,
      pending:    guests.filter(g => g.rsvp_status === 'pending' || !g.rsvp_status).length,
      meals: {
        beef:       allMeals.filter(m => m === 'beef').length,
        fish:       allMeals.filter(m => m === 'fish').length,
        vegetarian: allMeals.filter(m => m === 'vegetarian').length,
      },
    }
  }, [guests])

  const visible = useMemo(() => guests.filter(g => {
    const q = search.toLowerCase()
    const matchSearch = !q || g.household_name?.toLowerCase().includes(q) || g.primary_guest_name?.toLowerCase().includes(q) || g.email?.toLowerCase().includes(q)
    const matchFilter = filter === 'all' || g.rsvp_status === filter || (filter === 'pending' && !g.rsvp_status)
    return matchSearch && matchFilter
  }), [guests, search, filter])

  const allVisChecked  = visible.length > 0 && visible.every(g => selected.has(g._id))
  const someVisChecked = visible.some(g => selected.has(g._id)) && !allVisChecked

  const toggleRow = (id, checked) => setSelected(s => { const n = new Set(s); checked ? n.add(id) : n.delete(id); return n })
  const toggleAll = (checked) => setSelected(s => { const n = new Set(s); visible.forEach(g => checked ? n.add(g._id) : n.delete(g._id)); return n })

  const exportCSV = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([toCSV(guests)], { type: 'text/csv' }))
    a.download = `guests-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  // ─── Login ─────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6" style={{ background: '#0E0406' }}>
        <div className="w-full max-w-sm">
          <p className="font-serif uppercase tracking-[0.2em] text-3xl text-center mb-8">
            <span className="text-ink">Rod</span> <span className="text-primary">&amp;</span> <span className="silver-metallic">Paean</span>
          </p>
          <div className="bg-surface rounded-3xl p-8 border border-divider">
            <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-muted mb-6 text-center">Admin Access</p>
            <input type="password" value={pw}
              onChange={e => { setPw(e.target.value); setPwError(false) }}
              onKeyDown={e => e.key === 'Enter' && login()}
              placeholder="Password" autoFocus
              className="w-full bg-surface-2 border border-divider rounded-2xl px-5 py-3.5 font-body text-sm text-ink placeholder:text-muted/40 focus:outline-none focus:border-primary/40 transition-colors mb-3" />
            {pwError && <p className="font-body text-xs text-rose-400 mb-3">Incorrect password.</p>}
            <button onClick={login} className="w-full btn-amber-gradient text-white py-3.5 rounded-2xl font-subheading font-semibold text-sm">
              Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] text-ink" style={{ background: '#0E0406' }}>
      {showEmail  && <EmailModal  guests={guests} rsvpDeadline={rsvpDeadline} onClose={() => setShowEmail(false)} />}
      {showImport && <ImportModal guests={guests} onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); loadGuests() }} />}

      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-divider backdrop-blur-md" style={{ background: 'rgba(14,4,6,0.95)' }}>
        <div className="max-w-7xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between gap-3">
          <div className="flex items-baseline min-w-0">
            <p className="font-serif uppercase tracking-[0.15em] text-base sm:text-lg whitespace-nowrap -mr-[0.15em]">
              <span className="text-ink">Rod</span> <span className="text-primary">&amp;</span> <span className="silver-metallic">Paean</span>
            </p>
            <span className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted hidden sm:block ml-2">· Admin</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-divider cursor-pointer">
              <span className="font-subheading text-[9px] uppercase tracking-[0.15em] text-muted">RSVP by</span>
              <input type="date" value={rsvpDeadline} onChange={e => saveDeadline(e.target.value)}
                className="bg-transparent font-body text-xs text-ink focus:outline-none [color-scheme:dark]" />
            </label>
            <button onClick={toggleLock}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-subheading text-[9px] uppercase tracking-[0.15em] transition-colors ${
                rsvpLocked ? 'bg-rose-900/40 text-rose-400 border border-rose-500/20' : 'bg-surface border border-divider text-muted hover:text-ink'
              }`}>
              {rsvpLocked ? <><Lock className="h-3 w-3" /> Locked</> : <><Unlock className="h-3 w-3" /> Lock RSVPs</>}
            </button>
            <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-divider font-subheading text-[9px] uppercase tracking-[0.15em] text-muted hover:text-ink transition-colors">
              <Upload className="h-3 w-3" /> Import
            </button>
            <button onClick={() => setShowEmail(true)} disabled={guests.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full btn-amber-gradient text-white font-subheading text-[9px] uppercase tracking-[0.15em] font-semibold disabled:opacity-40 transition-opacity">
              <Mail className="h-3 w-3" /> Email Guests
            </button>
            <button onClick={exportCSV} disabled={guests.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-divider font-subheading text-[9px] uppercase tracking-[0.15em] text-muted hover:text-ink transition-colors disabled:opacity-40">
              <Download className="h-3 w-3" /> Export
            </button>
            <button onClick={loadGuests} disabled={loading} className="p-2 rounded-full text-muted hover:text-ink transition-colors" title="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={logout} className="p-2 rounded-full text-muted hover:text-ink transition-colors" title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          <StatCard label="Households"  value={stats.households} sub={`${stats.seatsInvited} seats invited`} />
          <StatCard label="Attending"   value={stats.attending}  sub="households" accent />
          <StatCard label="Declined"    value={stats.declined}   sub="households" />
          <StatCard label="Pending"     value={stats.pending}    sub="no response yet" />
          <StatCard label="Total Seats" value={stats.seatsConfirmed} sub={`of ${stats.seatsInvited} invited`} />
        </div>

        {fetchError && (
          <div className="bg-rose-900/20 border border-rose-500/20 rounded-2xl px-5 py-4 mb-6">
            <p className="font-body text-sm text-rose-400">{fetchError}</p>
          </div>
        )}

        {configError && (
          <div className="bg-rose-900/20 border border-rose-500/20 rounded-2xl px-5 py-4 mb-6">
            <p className="font-body text-sm text-rose-400">{configError}</p>
          </div>
        )}

        {/* Meal breakdown */}
        {stats.attending > 0 && (stats.meals.beef + stats.meals.fish + stats.meals.vegetarian) > 0 && (
          <div className="bg-surface rounded-2xl border border-divider px-6 py-4 mb-6">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <p className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted shrink-0">Meal selections</p>
              {[
                { label: 'Beef',       count: stats.meals.beef },
                { label: 'Fish',       count: stats.meals.fish },
                { label: 'Vegetarian', count: stats.meals.vegetarian },
              ].filter(m => m.count > 0).map(m => (
                <div key={m.label} className="flex items-baseline gap-1.5">
                  <span className="font-serif text-2xl text-ink">{m.count}</span>
                  <span className="font-body text-xs text-muted">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 bg-surface border border-divider rounded-full px-4 py-2 flex-1 min-w-[200px]">
            <Search className="h-3.5 w-3.5 text-muted shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guests…"
              className="bg-transparent font-body text-xs text-ink placeholder:text-muted/40 focus:outline-none w-full" />
          </div>
          <div className="flex items-center gap-1 bg-surface border border-divider rounded-full px-2 py-1.5">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full font-subheading text-[9px] uppercase tracking-[0.15em] transition-colors ${filter === f ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {selected.size > 0 && (
              <button onClick={deleteSelected}
                className="inline-flex items-center gap-2 bg-rose-900/30 border border-rose-500/30 text-rose-400 hover:bg-rose-900/50 px-4 py-2 rounded-full font-subheading font-semibold text-xs transition-colors">
                <Trash2 className="h-3 w-3" /> Delete selected ({selected.size})
              </button>
            )}
            <button onClick={addGuest} className="inline-flex items-center gap-1.5 font-subheading text-[9px] uppercase tracking-[0.15em] text-muted hover:text-ink border border-divider rounded-full px-4 py-2 transition-colors">
              <Plus className="h-3 w-3" /> Add Row
            </button>
          </div>
        </div>

        {/* Table */}
        {guests.length === 0 ? (
          <div className="border-2 border-dashed border-divider rounded-3xl py-24 text-center">
            <div onClick={() => setShowImport(true)} className="cursor-pointer hover:opacity-80 transition-opacity">
              <Upload className="h-8 w-8 text-muted/40 mx-auto mb-4" />
              <p className="font-body text-muted text-sm">Click to import a guest list CSV</p>
              <p className="font-body text-muted/40 text-xs mt-1">household_name · primary_guest_name · max_guests_allotted · email</p>
            </div>
            <p className="font-body text-muted/40 text-xs mt-6">— or —</p>
            <button onClick={addGuest}
              className="inline-flex items-center gap-1.5 font-subheading text-[9px] uppercase tracking-[0.15em] text-muted hover:text-ink border border-divider rounded-full px-4 py-2 mt-3 transition-colors">
              <Plus className="h-3 w-3" /> Add a guest manually
            </button>
          </div>
        ) : (
          <div className="bg-surface rounded-3xl border border-divider overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-divider">
                    {['Household', 'Title', 'Primary Guest', 'Seats', 'Email', 'RSVP', 'Meal', 'Dietary Notes', ''].map((h, i) => (
                      <th key={i} className="px-4 py-3.5 text-left font-subheading text-[9px] uppercase tracking-[0.18em] text-muted whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-4 py-3.5 pr-5 text-right">
                      <Checkbox checked={allVisChecked} indeterminate={someVisChecked} onChange={toggleAll} />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider/50">
                  {loading ? (
                    <tr><td colSpan={9} className="px-5 py-16 text-center">
                      <RefreshCw className="h-5 w-5 text-muted/40 animate-spin mx-auto" />
                    </td></tr>
                  ) : visible.length === 0 ? (
                    <tr><td colSpan={9} className="px-5 py-10 text-center font-body text-sm text-muted/40">
                      {guests.length === 0 ? 'No guests yet — import a CSV to get started.' : 'No results'}
                    </td></tr>
                  ) : visible.map(g => {
                    const isSelected = selected.has(g._id)
                    const members    = g.party_members || []
                    const isEditing  = editingId === g._id
                    return (
                      <Fragment key={g._id}>
                      <tr onClick={() => !isEditing && members.length > 0 && toggleParty(g._id)}
                        className={`group transition-colors ${isEditing ? '' : members.length > 0 ? 'cursor-pointer' : ''} ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-2/20'}`}>
                        <td className="px-4 py-3.5 max-w-[140px]">
                          {isEditing ? (
                            <input autoFocus value={edit.household_name} onChange={e => setEditField('household_name', e.target.value)}
                              onKeyDown={e => e.key === 'Escape' && cancelEdit()} placeholder="Household"
                              className="w-full bg-transparent border-b border-primary/40 focus:border-primary outline-none font-body text-xs text-ink pb-1 transition-colors" />
                          ) : (
                            <p className="font-body text-xs text-ink truncate">{g.household_name}</p>
                          )}
                          {g.email_sent && <p className="font-subheading text-[8px] uppercase tracking-wide text-primary/60 mt-0.5">Invited</p>}
                        </td>
                        <td className="px-4 py-3.5 w-20">
                          {isEditing
                            ? <SalutationSelect value={edit.salutation} onChange={v => setEditField('salutation', v)} />
                            : <span className="font-body text-xs text-muted">{g.salutation || '—'}</span>}
                        </td>
                        <td className="px-4 py-3.5 max-w-[130px]">
                          {isEditing ? (
                            <input
                              value={edit.primary_guest_name}
                              onChange={e => setEditField('primary_guest_name', e.target.value)}
                              onKeyDown={e => e.key === 'Escape' && cancelEdit()}
                              placeholder="Primary guest"
                              className="w-full bg-transparent border-b border-primary/40 focus:border-primary outline-none font-body text-xs text-ink pb-1 transition-colors"
                            />
                          ) : (
                            <GuestRow name={g.primary_guest_name} attending={g.primary_attending} rsvpStatus={g.rsvp_status} />
                          )}
                        </td>
                        <td className="px-4 py-3.5 w-16">
                          {isEditing ? (
                            <input type="number" min="1" value={edit.max_guests_allotted}
                              onChange={e => setEditField('max_guests_allotted', e.target.value)}
                              className="w-10 bg-transparent border-b border-primary/40 focus:border-primary outline-none font-body text-xs text-ink pb-1 transition-colors" />
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="font-body text-xs text-muted">
                                {g.rsvp_status === 'attending' ? (g.num_attending ?? 0) : g.max_guests_allotted}
                              </span>
                              {members.length > 0 && (
                                <ChevronDown className={`h-3 w-3 text-muted shrink-0 transition-transform ${expandedParty.has(g._id) ? 'rotate-180' : ''}`} />
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 max-w-[160px]">
                          {isEditing ? (
                            <input value={edit.email} onChange={e => setEditField('email', e.target.value)} placeholder="—"
                              className="w-full bg-transparent border-b border-primary/40 focus:border-primary outline-none font-body text-xs text-muted pb-1 transition-colors" />
                          ) : (
                            <span className="font-body text-xs text-muted truncate block">{g.email || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {isEditing
                            ? <RSVPSelect value={edit.rsvp_status} onChange={v => setEditField('rsvp_status', v)} />
                            : <RSVPBadge value={g.rsvp_status} />}
                        </td>
                        <td className="px-4 py-3.5">
                          {isEditing
                            ? <MealSelect value={edit.primary_meal_choice} onChange={v => setEditField('primary_meal_choice', v)} />
                            : <span className="font-mono text-[10px] text-muted capitalize">{g.primary_meal_choice || '—'}</span>}
                        </td>
                        <td className="px-4 py-3.5 max-w-[160px]">
                          {isEditing ? (
                            <input value={edit.dietary_restrictions} onChange={e => setEditField('dietary_restrictions', e.target.value)} placeholder="—"
                              className="w-full bg-transparent border-b border-primary/40 focus:border-primary outline-none font-body text-xs text-muted pb-1 transition-colors" />
                          ) : (
                            <span className="font-body text-xs text-muted truncate block">{g.dietary_restrictions || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 w-16">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <button onClick={saveEdit} className="font-body text-[10px] px-2 py-1 rounded-full bg-primary text-white font-medium">Save</button>
                              <button onClick={cancelEdit} className="font-body text-[10px] px-2 py-1 rounded-full border border-divider text-muted hover:text-ink transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={e => { e.stopPropagation(); startEdit(g) }} className="text-muted hover:text-ink transition-colors" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={e => { e.stopPropagation(); removeGuest(g._id) }} className="text-muted hover:text-rose-400 transition-colors" title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 pr-5 w-10 text-right" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={isSelected} indeterminate={false} onChange={c => toggleRow(g._id, c)} />
                        </td>
                      </tr>
                      {isEditing && edit.party_members.map((m, i) => {
                        const setMember = (fields) => setEditField('party_members', edit.party_members.map((pm, pi) => pi === i ? { ...pm, ...fields } : pm))
                        return (
                          <tr key={`edit-${i}`} className="bg-surface-2/20">
                            <td className="px-4 py-2 max-w-[140px]">
                              <CornerDownRight className="h-3 w-3 text-muted/30" />
                            </td>
                            <td className="px-4 py-2 w-20" />
                            <td className="px-4 py-2 max-w-[130px]">
                              {m.needsName ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-body text-xs text-muted italic truncate">Named by guest</span>
                                  <button type="button" onClick={() => setMember({ needsName: false })}
                                    className="font-subheading text-[8px] uppercase tracking-wide text-primary/70 hover:text-primary transition-colors shrink-0">
                                    Undo
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <input value={m.name} onChange={e => setMember({ name: e.target.value })} placeholder="Party member"
                                    className="w-full min-w-0 bg-transparent border-b border-divider focus:border-primary outline-none font-body text-xs text-ink pb-1 transition-colors" />
                                  <button type="button" onClick={() => setMember({ needsName: true, name: '' })}
                                    title="Plus-one not named yet — let the guest fill it in on the RSVP page"
                                    className="font-subheading text-[8px] uppercase tracking-wide text-muted hover:text-primary transition-colors shrink-0 whitespace-nowrap">
                                    TBD?
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 w-16" />
                            <td className="px-4 py-2 max-w-[160px]" />
                            <td className="px-4 py-2">
                              <MemberRSVPSelect attending={m.attending} onChange={v => setMember({ attending: v })} />
                            </td>
                            <td className="px-4 py-2">
                              <MealSelect value={m.meal_choice} onChange={v => setMember({ meal_choice: v })} />
                            </td>
                            <td className="px-4 py-2 max-w-[160px]">
                              <input value={m.dietary_notes || ''} onChange={e => setMember({ dietary_notes: e.target.value })} placeholder="—"
                                className="w-full min-w-0 bg-transparent border-b border-divider focus:border-primary outline-none font-body text-xs text-muted pb-1 transition-colors" />
                            </td>
                            <td className="px-4 py-2 w-16">
                              <button type="button" onClick={() => setEditPartyMembers(edit.party_members.filter((_, pi) => pi !== i))}
                                className="text-muted hover:text-rose-400 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                              </button>
                            </td>
                            <td className="px-4 py-2 pr-5 w-10" />
                          </tr>
                        )
                      })}
                      {isEditing && (
                        <tr className="bg-surface-2/20">
                          <td className="px-4 py-2" colSpan={2} />
                          <td className="px-4 py-2" colSpan={8}>
                            <button type="button" onClick={() => setEditPartyMembers([...edit.party_members, { name: '', attending: null, meal_choice: '', dietary_notes: '' }])}
                              className="text-left font-body text-xs text-muted hover:text-primary transition-colors">
                              + add member
                            </button>
                          </td>
                        </tr>
                      )}
                      {!isEditing && expandedParty.has(g._id) && members.map((m, i) => {
                        const status = memberStatus(m)
                        return (
                          <tr key={`view-${i}`} className="bg-surface-2/20">
                            <td className="px-4 py-2 max-w-[140px]">
                              <CornerDownRight className="h-3 w-3 text-muted/30" />
                            </td>
                            <td className="px-4 py-2 w-20" />
                            <td className="px-4 py-2 max-w-[130px]">
                              {m.needsName ? (
                                <span className="font-body text-xs text-muted italic truncate">Plus-one — named by guest</span>
                              ) : (
                                <span className="font-body text-xs text-ink truncate">{m.name || 'Guest'}</span>
                              )}
                            </td>
                            <td className="px-4 py-2 w-16" />
                            <td className="px-4 py-2 max-w-[160px]" />
                            <td className="px-4 py-2">
                              <RSVPBadge value={status} />
                            </td>
                            <td className="px-4 py-2">
                              <span className="font-mono text-[10px] text-muted capitalize">
                                {status === 'attending' ? (m.meal_choice || '—') : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-2 max-w-[160px]">
                              <span className="font-body text-xs text-muted truncate block">{m.dietary_notes || '—'}</span>
                            </td>
                            <td className="px-4 py-2 w-16" />
                            <td className="px-4 py-2 pr-5 w-10" />
                          </tr>
                        )
                      })}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-divider">
              <p className="font-body text-xs text-muted/50">
                {visible.length < guests.length ? `${visible.length} of ${guests.length} households` : `${guests.length} households`}
                {selected.size > 0 && ` · ${selected.size} selected`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
