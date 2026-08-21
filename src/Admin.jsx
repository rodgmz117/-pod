import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Upload, LogOut, Pencil, Trash2, Plus, Download, Search,
  Send, X, Check, RefreshCw, Lock, Unlock, Mail, ChevronDown,
} from 'lucide-react'
import { getAllGuests, insertGuests, updateGuestField, deleteGuest } from './lib/supabase.js'

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

function MealSelect({ value, onChange }) {
  const labels = { beef: 'Beef', fish: 'Fish', vegetarian: 'Veg' }
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{ borderColor: 'rgba(196,100,32,0.25)', background: 'rgba(58,14,24,0.72)', color: value ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)' }}
      className="rounded-lg px-3 py-1.5 font-subheading text-[10px] uppercase tracking-[0.15em] focus:outline-none transition-colors cursor-pointer"
    >
      <option value="">—</option>
      <option value="beef">Beef</option>
      <option value="fish">Fish</option>
      <option value="vegetarian">Veg</option>
    </select>
  )
}

function EditableCell({ value, onChange, placeholder = '—', dim }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
  const commit = () => { onChange(draft); setEditing(false) }
  const cancel = () => { setDraft(value); setEditing(false) }
  if (editing)
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        className="w-full bg-surface-2 border border-primary/40 rounded-lg px-2 py-1 font-body text-xs text-ink focus:outline-none"
      />
    )
  return (
    <button onClick={() => { setDraft(value); setEditing(true) }}
      className={`group flex items-center gap-1 text-left hover:opacity-70 transition-opacity w-full ${dim ? 'text-muted' : 'text-ink'}`}>
      <span className="font-body text-xs">{value || <span className="text-white/20">{placeholder}</span>}</span>
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-30 shrink-0" />
    </button>
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
function EmailModal({ guests, selected, onClose }) {
  const [step, setStep]           = useState('compose')
  const [recipientMode, setMode]  = useState(selected.size > 0 ? 'selected' : 'pending')
  const [subject, setSubject]     = useState("You're invited — Rod & Paean, March 27, 2027")
  const [body, setBody]           = useState("We would be so honored to celebrate our wedding day with you. We've reserved a place in your name.")
  const [testEmail, setTestEmail] = useState('')
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])

  const withEmail = useMemo(() => {
    if (recipientMode === 'selected') return guests.filter(g => selected.has(g._id) && g.email)
    if (recipientMode === 'pending')  return guests.filter(g => !g.rsvp && g.email)
    return guests.filter(g => g.email)
  }, [guests, selected, recipientMode])

  const counts = useMemo(() => ({
    selected: guests.filter(g => selected.has(g._id) && g.email).length,
    pending:  guests.filter(g => !g.rsvp && g.email).length,
    all:      guests.filter(g => g.email).length,
  }), [guests, selected])

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
            {step === 'sending' ? 'Sending…' : step === 'done' ? (result?.isTest ? 'Test sent' : 'Invitations sent') : 'Email Guests'}
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

          {step === 'compose' && (
            <>
              <div>
                <p className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted mb-2.5">Recipients</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'selected', label: 'Selected',    count: counts.selected },
                    { value: 'pending',  label: 'No RSVP yet', count: counts.pending  },
                    { value: 'all',      label: 'Everyone',    count: counts.all      },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setMode(opt.value)}
                      className={`flex flex-col items-start px-4 py-3 rounded-2xl border-2 text-left transition-colors ${
                        recipientMode === opt.value ? 'border-primary bg-primary/5' : 'border-divider hover:border-primary/30'
                      }`}>
                      <span className="font-serif text-2xl text-ink leading-none mb-1">{opt.count}</span>
                      <span className="font-body text-xs text-muted leading-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
                {counts.all === 0 && <p className="font-body text-xs text-amber-400 mt-2">No guests have email addresses on file.</p>}
              </div>

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
                  <p className="font-body text-xs text-muted"><span className="text-ink font-medium">From:</span> Rod &amp; Paean &lt;noreply@sohappitogether.com&gt;</p>
                  <p className="font-body text-xs text-muted"><span className="text-ink font-medium">Subject:</span> {subject || '—'}</p>
                </div>
                <div className="border-t border-divider pt-3">
                  <p className="font-body text-sm text-ink mb-1">Dear {previewName},</p>
                  <p className="font-body text-xs text-muted line-clamp-2">{body}</p>
                  <div className="mt-2.5">
                    <span className="inline-block bg-primary text-white font-body text-xs font-semibold px-4 py-1.5 rounded-full">RSVP Now</span>
                  </div>
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

        {step === 'compose' && (
          <div className="px-7 py-5 border-t border-divider shrink-0 flex items-center justify-between gap-3">
            <button onClick={onClose} className="font-body text-sm text-muted hover:text-ink transition-colors">Cancel</button>
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
  const [rsvpLocked, setRsvpLocked] = useState(false)

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
    setGuests((data || []).map(g => ({ ...g, _id: g.id })))
  }

  useEffect(() => { if (authed) loadGuests() }, [authed])

  const updateGuest = async (id, field, value) => {
    setGuests(gs => gs.map(g => g._id === id ? { ...g, [field]: value } : g))
    const guest = guests.find(g => g._id === id)
    if (guest?.id) await updateGuestField(guest.id, field, value)
  }

  const removeGuest = async (id) => {
    setGuests(gs => gs.filter(g => g._id !== id))
    setSelected(s => { const n = new Set(s); n.delete(id); return n })
    const guest = guests.find(g => g._id === id)
    if (guest?.id) await deleteGuest(guest.id)
  }

  const addGuest = () => setGuests(gs => [...gs, {
    _id: `local_${Date.now()}`, id: null,
    household_name: '', primary_guest_name: '',
    max_guests_allotted: 1, email: '', rsvp_status: 'pending', party_members: [],
  }])

  const stats = useMemo(() => {
    const attending = guests.filter(g => g.rsvp_status === 'attending')
    const allMeals  = attending.flatMap(g => [
      g.primary_meal_choice,
      ...(g.party_members || []).map(m => m.meal_choice),
    ]).filter(Boolean)
    return {
      households: guests.length,
      seats:      guests.reduce((s, g) => s + (parseInt(g.max_guests_allotted) || 1), 0),
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

  const selectedWithEmail = guests.filter(g => selected.has(g._id) && g.email)

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
          <p className="font-script text-4xl gradient-text text-center mb-8">Rod &amp; Paean</p>
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
      {showEmail  && <EmailModal  guests={guests} selected={selected} onClose={() => setShowEmail(false)} />}
      {showImport && <ImportModal guests={guests} onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); loadGuests() }} />}

      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-divider backdrop-blur-md" style={{ background: 'rgba(14,4,6,0.95)' }}>
        <div className="max-w-7xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <p className="font-script text-xl gradient-text">Rod &amp; Paean</p>
            <span className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted hidden sm:block">· Admin</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setRsvpLocked(l => !l)}
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
          <StatCard label="Households"  value={stats.households} sub={`${stats.seats} seats invited`} />
          <StatCard label="Attending"   value={stats.attending}  sub="households" accent />
          <StatCard label="Declined"    value={stats.declined}   sub="households" />
          <StatCard label="Pending"     value={stats.pending}    sub="no response yet" />
          <StatCard label="Total Seats" value={stats.seats}      sub="across all households" />
        </div>

        {fetchError && (
          <div className="bg-rose-900/20 border border-rose-500/20 rounded-2xl px-5 py-4 mb-6">
            <p className="font-body text-sm text-rose-400">{fetchError}</p>
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
          {guests.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              {selected.size > 0 && (
                <button onClick={() => setShowEmail(true)}
                  className="inline-flex items-center gap-2 btn-amber-gradient text-white px-4 py-2 rounded-full font-subheading font-semibold text-xs">
                  <Send className="h-3 w-3" /> Email selected ({selectedWithEmail.length})
                </button>
              )}
              <button onClick={addGuest} className="inline-flex items-center gap-1.5 font-subheading text-[9px] uppercase tracking-[0.15em] text-muted hover:text-ink border border-divider rounded-full px-4 py-2 transition-colors">
                <Plus className="h-3 w-3" /> Add Row
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        {guests.length === 0 ? (
          <div onClick={() => setShowImport(true)} className="border-2 border-dashed border-divider rounded-3xl py-24 text-center cursor-pointer hover:border-primary/40 transition-colors">
            <Upload className="h-8 w-8 text-muted/40 mx-auto mb-4" />
            <p className="font-body text-muted text-sm">Click to import a guest list CSV</p>
            <p className="font-body text-muted/40 text-xs mt-1">household_name · primary_guest_name · max_guests_allotted · email</p>
          </div>
        ) : (
          <div className="bg-surface rounded-3xl border border-divider overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-divider">
                    {['Household', 'Title', 'Primary Guest', 'Party Members', 'Seats', 'Email', 'RSVP', 'Meal', 'Dietary Notes', ''].map((h, i) => (
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
                    return (
                      <tr key={g._id} className={`group transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-2/20'}`}>
                        <td className="px-4 py-3.5 max-w-[140px]">
                          <EditableCell value={g.household_name} onChange={v => updateGuest(g._id, 'household_name', v)} placeholder="Household" />
                          {g.email_sent && <p className="font-subheading text-[8px] uppercase tracking-wide text-primary/60 mt-0.5">Invited</p>}
                        </td>
                        <td className="px-4 py-3.5 w-20">
                          <SalutationSelect value={g.salutation} onChange={v => updateGuest(g._id, 'salutation', v)} />
                        </td>
                        <td className="px-4 py-3.5 max-w-[130px]">
                          <EditableCell value={g.primary_guest_name} onChange={v => updateGuest(g._id, 'primary_guest_name', v)} placeholder="Name" />
                        </td>
                        <td className="px-4 py-3.5 max-w-[160px]">
                          {members.length > 0
                            ? <div className="space-y-0.5">{members.map((m, i) => <p key={i} className="font-body text-xs text-muted">{m.name}</p>)}</div>
                            : <span className="font-body text-xs text-white/20">—</span>}
                        </td>
                        <td className="px-4 py-3.5 w-12">
                          <EditableCell value={g.max_guests_allotted} onChange={v => updateGuest(g._id, 'max_guests_allotted', v)} dim />
                        </td>
                        <td className="px-4 py-3.5 max-w-[160px]">
                          <EditableCell value={g.email} onChange={v => updateGuest(g._id, 'email', v)} placeholder="—" dim />
                        </td>
                        <td className="px-4 py-3.5">
                          <RSVPSelect value={g.rsvp_status} onChange={v => updateGuest(g._id, 'rsvp_status', v)} />
                        </td>
                        <td className="px-4 py-3.5">
                          <MealSelect value={g.primary_meal_choice} onChange={v => updateGuest(g._id, 'primary_meal_choice', v)} />
                        </td>
                        <td className="px-4 py-3.5 max-w-[160px]">
                          <EditableCell value={g.dietary_restrictions} onChange={v => updateGuest(g._id, 'dietary_restrictions', v)} placeholder="—" dim />
                        </td>
                        <td className="px-4 py-3.5 w-10">
                          <button onClick={() => removeGuest(g._id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-rose-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                        <td className="px-4 py-3.5 pr-5 w-10 text-right">
                          <Checkbox checked={isSelected} indeterminate={false} onChange={c => toggleRow(g._id, c)} />
                        </td>
                      </tr>
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
