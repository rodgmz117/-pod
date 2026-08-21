import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

// ─── Guest lookup (RSVP page) ─────────────────────────────────────────────────
export async function findGuest(name) {
  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .ilike('primary_guest_name', name.trim())
    .maybeSingle()
  return { data, error }
}

// ─── RSVP submission (RSVP page) ──────────────────────────────────────────────
export async function submitRSVP(guestId, payload) {
  const { data, error } = await supabase
    .from('guests')
    .update({
      ...payload,
      rsvp_submitted_at: new Date().toISOString(),
      rsvp_updated_at:   new Date().toISOString(),
    })
    .eq('id', guestId)
    .select()
    .single()
  return { data, error }
}

// ─── Config (RSVP locked state + deadline) ────────────────────────────────────
export async function getConfig() {
  const { data } = await supabase.from('wedding_config').select('*').single()
  return data
}

// ─── Admin: read ──────────────────────────────────────────────────────────────
export async function getAllGuests() {
  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .order('household_name', { ascending: true })
  return { data, error }
}

// ─── Admin: write ─────────────────────────────────────────────────────────────
export async function insertGuests(rows) {
  const { data, error } = await supabase.from('guests').insert(rows).select()
  return { data, error }
}

export async function updateGuestField(id, field, value) {
  const { error } = await supabase.from('guests').update({ [field]: value }).eq('id', id)
  return { error }
}

export async function deleteGuest(id) {
  const { error } = await supabase.from('guests').delete().eq('id', id)
  return { error }
}
