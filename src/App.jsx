import { useEffect, useRef, useState, useCallback } from 'react'
import Admin from './Admin.jsx'
import { findGuest, submitRSVP, getConfig } from './lib/supabase.js'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  Heart, Plane, Building,
  ExternalLink, ChevronDown, Check, Search,
  CalendarHeart, Compass, Send, HandHeart, MessageCircleQuestion,
  Gem, Wine, PartyPopper,
} from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)


const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function formatDeadline(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const COUPLE = {
  name1: 'Rod',
  name2: 'Paean',
  initials: 'R&P',
  date: '2027-03-27',
  dateLong: 'March 27, 2027',
  venue: 'Montage Laguna Beach',
  address: '30801 Coast Hwy, Laguna Beach, CA 92651',
  city: 'Laguna Beach, CA',
  dressCode: 'Black Tie Optional',
  rsvpDeadline: 'January 15, 2027',
  airport: 'John Wayne Airport (SNA)',
  airportDistance: 'Approx. 30 min via I-405 & CA-133',
  brandName: 'SO HAPPI',
}

const SCHEDULE = [
  { time: '5:00 PM',   event: 'Ceremony',           location: 'Ocean Lawn',     icon: 'Gem',        note: 'Please give yourself 15 minutes before the ceremony.' },
  { time: 'Following', event: 'Cocktail Reception', location: 'Pacific Lawn',   icon: 'Wine' },
  { time: 'Evening',   event: 'Dinner & Dancing',   location: 'Grand Ballroom', icon: 'PartyPopper' },
]

const EVENT_ICONS = { Gem, Wine, PartyPopper }

const HOTELS = [
  {
    name: 'Le Petit Pali Laguna Beach',
    distance: '~650 ft',
    note: 'Literally across Coast Hwy from Montage',
    url: 'https://www.lepetitpali.com/locations/laguna-beach',
  },
  {
    name: 'The Ranch at Laguna Beach',
    distance: '~1.5 miles',
    note: 'Boutique resort tucked into Laguna Canyon.',
    url: 'https://be.synxis.com/?hotel=61912&chain=10237&arrive=2027-03-26&depart=2027-03-28&adult=2&currency=USD&locale=en-US',
  },
  {
    name: 'Laguna Cliffs Marriott Resort & Spa',
    distance: '~8 miles (Dana Point)',
    note: 'Clifftop resort, easy rideshare distance',
    url: 'https://www.marriott.com/reservation/availabilitySearch.mi?propertyCode=SNADP&fromDate=03/26/2027&toDate=03/28/2027',
  },
]

const FAQ_ITEMS = [
  {
    q: "What's the parking situation?",
    a: "Valet is available at Montage, but we'd love for you to rideshare. PCH at midnight is not the move.",
  },
  {
    q: "I heard the ceremony is outdoors. Will it be cold?",
    a: "Laguna Beach in late March is typically 60–65°F by evening. The ceremony and cocktail hour are on the grass. Bring a wrap.",
  },
  {
    q: "Are kids invited?",
    a: "We love your kids. This evening is adults-only.",
  },
  {
    q: "What does Black Tie Optional actually mean?",
    a: "You don't have to wear a tux — but attire should be on the formal side. Think dark suits, floor-length gowns, or elegant midi dresses. Save the sundresses and anything spring-casual for another occasion. If you're unsure whether it's too dressed down, it probably is.",
  },
]

const TABS = [
  { id: 'home',    label: 'Home' },
  { id: 'rsvp',    label: 'Join Us' },
  { id: 'details', label: 'The Day' },
  { id: 'travel',  label: 'Travel & Stay' },
  { id: 'gifts',   label: 'Gifts' },
  { id: 'faq',     label: 'Questions' },
]

// ─── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(targetDate) {
  const calc = () => {
    const diff = new Date(targetDate) - new Date()
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
    return {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    }
  }
  const [time, setTime] = useState(calc)
  useEffect(() => {
    const t = setInterval(() => setTime(calc()), 1000)
    return () => clearInterval(t)
  }, [targetDate])
  return time
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ scrollToSection, menuOpen, setMenuOpen }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 w-full h-16 flex items-center justify-between px-6 sm:px-10 backdrop-blur-sm border-b border-white/8" style={{ background: 'rgba(0,0,0,0.32)' }}>
      <button
        onClick={() => scrollToSection('home')}
        className="group flex items-center justify-center"
        aria-label="Home"
      >
        <img
          src="/monogram.jpg"
          alt="P & R monogram"
          className="transition-transform duration-200 group-hover:scale-105"
          style={{ width: '44px', height: '44px', objectFit: 'cover', mixBlendMode: 'multiply', borderRadius: '50%' }}
        />
      </button>
      <button
        onClick={() => setMenuOpen(o => !o)}
        className="font-serif text-sm tracking-[0.2em] text-white/70 hover:text-white transition-colors"
        aria-label="Toggle menu" aria-expanded={menuOpen}
      >
        {menuOpen ? 'CLOSE' : 'MENU'}
      </button>
    </nav>
  )
}

// ─── Menu Overlay ───────────────────────────────────────────────────────────────
function MenuOverlay({ open, onClose, scrollToSection }) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(14,4,6,0.97)' }} onClick={onClose}>
      <nav className="flex flex-col items-center gap-1" onClick={e => e.stopPropagation()}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => scrollToSection(tab.id)}
            className="lift-on-hover px-8 py-3 font-serif text-2xl sm:text-3xl text-ink/85 hover:text-primary-light transition-colors border-b border-transparent hover:border-primary/40"
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ scrollToSection }) {
  const ref = useRef(null)
  const { days, hours, minutes, seconds } = useCountdown(COUPLE.date)

  useEffect(() => {
    if (prefersReducedMotion) return
    const ctx = gsap.context(() => {
      gsap.from('.hero-name-1',  { y: 52, opacity: 0, duration: 1.2, delay: 0.5,  ease: 'power3.out' })
      gsap.from('.hero-monogram', { scale: 0.9, opacity: 0, duration: 1,   delay: 0.6,  ease: 'power3.out' })
      gsap.from('.hero-name-2',  { y: 52, opacity: 0, duration: 1.2, delay: 0.72, ease: 'power3.out' })
      gsap.from('.hero-venue',   { y: 16, opacity: 0, duration: 0.8, delay: 0.85, ease: 'power3.out' })
      gsap.from('.hero-count',   { y: 16, opacity: 0, duration: 0.8, delay: 1.05, ease: 'power3.out' })
      gsap.from('.hero-cta',     { y: 16, opacity: 0, duration: 0.8, delay: 1.2,  ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={ref} id="home" className="relative min-h-[85dvh] sm:min-h-[100dvh] overflow-hidden">
      <div className="absolute inset-0 flex flex-col justify-center py-16 sm:py-24">
        <div className="max-w-6xl mx-auto w-full px-6 sm:px-10 lg:px-16 text-center">
          <h1 className="leading-relaxed">
            <span className="hero-name-1 block font-serif uppercase text-2xl sm:text-3xl lg:text-4xl tracking-[0.25em] text-ink/90">
              {COUPLE.name1}
            </span>
            <img
              src="/home-hero.jpg"
              alt=""
              className="hero-monogram block mx-auto my-3 sm:my-4 h-40 sm:h-56 lg:h-72 w-auto object-cover"
            />
            <span className="hero-name-2 block font-serif uppercase text-2xl sm:text-3xl lg:text-4xl tracking-[0.25em] silver-metallic">
              {COUPLE.name2}
            </span>
          </h1>

          <div className="hero-venue mt-5 sm:mt-6">
            <p className="font-body text-[11px] sm:text-xs uppercase tracking-[0.25em] text-white/50 mb-2">
              Please join us for our wedding celebration
            </p>
            <p className="font-serif text-lg sm:text-xl text-ink/90 tracking-wide">
              {COUPLE.dateLong}
            </p>
            <p className="font-serif italic text-sm text-white/50 mt-1">
              {COUPLE.venue} &middot; {COUPLE.city}
            </p>
          </div>

          <div className="hero-count flex items-center justify-center gap-6 sm:gap-8 mt-5 sm:mt-6">
            {[
              { v: days,    l: 'Days' },
              { v: hours,   l: 'Hours' },
              { v: minutes, l: 'Min' },
              { v: seconds, l: 'Sec' },
            ].map(({ v, l }) => (
              <div key={l} className="text-center">
                <div className="font-serif text-2xl sm:text-3xl font-medium text-ink tabular-nums">
                  {String(v).padStart(2, '0')}
                </div>
                <div className="font-subheading text-[9px] uppercase tracking-[0.22em] text-white/30 mt-0.5">{l}</div>
              </div>
            ))}
          </div>

          <div className="hero-cta flex justify-center mt-5 sm:mt-6">
            <button
              onClick={() => scrollToSection('rsvp')}
              className="lift-on-hover btn-outline-sharp inline-flex items-center gap-2 px-8 py-3 font-serif text-base tracking-[0.05em]"
            >
              RSVP
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Our Story ────────────────────────────────────────────────────────────────
// ─── Event Details ────────────────────────────────────────────────────────────
function EventDetails() {
  const ref = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion) return
    const ctx = gsap.context(() => {
      gsap.from('.event-card', {
        scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true },
        y: 36, opacity: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out',
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(COUPLE.venue + ', ' + COUPLE.address)}`

  return (
    <section ref={ref} id="details" className="scroll-mt-16 pt-10 pb-20 sm:pb-28">
      <div className="max-w-3xl mx-auto px-6 sm:px-10">
        <div className="text-center mb-14">
          <CalendarHeart className="h-8 w-8 text-primary/40 mx-auto mb-4" strokeWidth={1.25} />
          <p className="font-subheading text-sm uppercase tracking-[0.26em] text-primary">The Day</p>
          <div className="gold-line w-24 mx-auto mt-6" />
        </div>

        <div className="event-card bg-surface rounded-3xl px-8 py-7 border border-divider mb-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-muted mb-1.5">Venue</p>
              <h3 className="font-serif text-xl font-medium text-ink">{COUPLE.venue}</h3>
              <p className="font-body text-sm text-muted mt-1">{COUPLE.address}</p>
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-body text-primary hover:opacity-70 transition-opacity mt-1 lift-on-hover"
            >
              Directions <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.2} />
            </a>
          </div>
          <div className="mt-5 pt-5 border-t border-divider">
            <div className="flex items-center justify-between mb-2">
              <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-muted">Dress Code</p>
              <p className="font-subheading text-[10px] uppercase tracking-[0.16em] text-ink">{COUPLE.dressCode}</p>
            </div>
            <p className="font-body text-xs text-muted leading-relaxed">
              Tuxedos welcome, not required — but attire should be formal. Dark suits, floor-length or midi gowns.
            </p>
          </div>
          <div className="mt-5 pt-5 border-t border-divider">
            <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-muted mb-2">Getting Here</p>
            <p className="font-body text-muted text-xs leading-relaxed">
              Valet parking is available at Montage, but we strongly recommend rideshare. Come, celebrate, get home safely.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 mb-5">
          {SCHEDULE.map((item, i) => {
            const Icon = EVENT_ICONS[item.icon]
            return (
              <div key={i} className="event-card bg-surface rounded-3xl px-7 py-8 border border-divider text-center w-full max-w-xs">
                <Icon className="h-7 w-7 text-primary/50 mx-auto mb-4" strokeWidth={1.25} />
                <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-primary mb-2">{item.event}</p>
                <p className="font-body text-sm text-muted">{item.time} · {item.location}</p>
                {item.note && <p className="font-body text-xs text-muted mt-2">{item.note}</p>}
              </div>
            )
          })}
        </div>

        <div className="event-card bg-surface/50 rounded-2xl px-6 py-5 border border-divider/60 mb-5">
          <p className="font-body text-sm text-muted leading-relaxed">
            <span className="text-primary font-medium">Note —</span>{' '}
            The ceremony and cocktail hour are outdoors on the grass. Laguna Beach in late March is typically 60–65°F by evening. Bring a wrap if you run cold.
          </p>
        </div>

      </div>
    </section>
  )
}

// ─── Travel ───────────────────────────────────────────────────────────────────
function Travel() {
  const ref = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion) return
    const ctx = gsap.context(() => {
      gsap.from('.travel-card', {
        scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true },
        y: 36, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out',
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={ref} id="travel" className="scroll-mt-16 pt-10 pb-20 sm:pb-28">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="text-center mb-14">
          <Compass className="h-8 w-8 text-primary/40 mx-auto mb-4" strokeWidth={1.25} />
          <p className="font-subheading text-sm uppercase tracking-[0.26em] text-primary">Travel &amp; Stay</p>
          <div className="gold-line w-24 mx-auto mt-6" />
        </div>

        {/* Stay With Us — Montage room block */}
        <div className="max-w-2xl mx-auto mb-6">
          <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-primary mb-4 text-right">Stay With Us</p>
          <div className="travel-card bg-surface rounded-3xl p-8 border border-divider">
            <h3 className="font-serif text-xl font-medium text-ink mb-3">{COUPLE.venue}</h3>
            <p className="font-body text-sm text-muted leading-relaxed">
              We're holding a room block at {COUPLE.venue} — our wedding venue — so you can stay right where the celebration is happening. Rate, minimum-night requirement, and booking deadline to come.
            </p>
            <span className="inline-flex items-center gap-1.5 mt-6 px-6 py-3 border border-divider text-muted/60 text-xs font-serif tracking-[0.03em] cursor-default">
              Booking Link Coming Soon
            </span>
          </div>
        </div>

        {/* Alternate accommodations */}
        <div className="max-w-4xl mx-auto mb-10">
          <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-primary mb-4">Alternate Accommodations</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {HOTELS.map((hotel, i) => (
              <div key={i} className="travel-card bg-surface rounded-3xl p-6 border border-divider flex flex-col">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mauve/10 mb-4">
                  <Building className="h-4 w-4 text-mauve" strokeWidth={2.2} />
                </div>
                <p className="font-subheading text-[9px] uppercase tracking-[0.16em] text-primary mb-1">{hotel.distance}</p>
                <h3 className="font-serif text-sm font-medium text-ink mb-1 leading-snug">{hotel.name}</h3>
                <p className="font-body text-xs text-muted mb-4 leading-relaxed flex-1">{hotel.note}</p>
                <a
                  href={hotel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lift-on-hover btn-outline-sharp inline-flex items-center gap-1.5 px-4 py-2 text-xs font-serif tracking-[0.03em] self-center"
                >
                  View Hotel <ExternalLink className="h-3 w-3" strokeWidth={2.2} />
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-md mx-auto">
          <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-primary mb-4 text-center">Nearest Airport</p>
          <div className="travel-card bg-surface rounded-3xl p-7 border border-divider flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Plane className="h-5 w-5 text-primary" strokeWidth={2.2} />
            </div>
            <div>
              <p className="font-serif text-sm font-medium text-ink mb-1">{COUPLE.airport}</p>
              <p className="font-body text-xs text-muted leading-relaxed">{COUPLE.airportDistance}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Red Envelopes ────────────────────────────────────────────────────────────
function RedEnvelopes() {
  const ref = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion) return
    const ctx = gsap.context(() => {
      gsap.from('.envelope-card', {
        scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true },
        y: 36, opacity: 0, duration: 0.9, ease: 'power3.out',
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={ref} id="gifts" className="scroll-mt-16 pt-10 pb-20 sm:pb-28">
      <div className="max-w-md mx-auto px-6 text-center">
        <HandHeart className="h-8 w-8 text-primary/40 mx-auto mb-4" strokeWidth={1.25} />
        <p className="font-subheading text-sm uppercase tracking-[0.26em] text-primary">Gifts</p>
        <div className="section-divider w-24 mx-auto mt-6 mb-10" />

        <div className="envelope-card red-envelope-glow rounded-3xl border border-white/10 overflow-hidden text-left relative" style={{ background: 'rgba(48, 6, 12, 0.96)' }}>
          <div className="hidden sm:flex items-center justify-center pt-8 pb-6 relative border-b border-white/10 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.12 }}>
              <svg width="100%" height="100%" viewBox="0 0 400 140" preserveAspectRatio="none">
                <line x1="0" y1="4" x2="200" y2="118" stroke="white" strokeWidth="0.8" />
                <line x1="400" y1="4" x2="200" y2="118" stroke="white" strokeWidth="0.8" />
              </svg>
            </div>
            <img
              src="/monogram-pr.jpg"
              alt="R & P monogram"
              className="relative"
              style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '50%' }}
            />
          </div>

          <div className="px-8 pb-10 sm:pt-8 pt-10 relative">
            <p className="font-body text-muted leading-relaxed text-sm mb-5">
              We aren't registered anywhere. In place of a traditional gift, we warmly welcome red envelopes — a tradition meaningful to us and to Paean's family. A red envelope is a gift of good fortune and blessings for the new chapter ahead.
            </p>
            <p className="font-body text-muted leading-relaxed text-sm">
              If you'd like to bring one, we'll have a box at the reception. There is absolutely no obligation — your presence at this celebration is the only thing we asked for when we sent the invitations.
            </p>
            <div className="mt-8 pt-8 border-t border-divider text-center">
              <p className="font-serif italic text-sm text-primary/55">With gratitude — Rod &amp; Paean</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── RSVP ─────────────────────────────────────────────────────────────────────
const MEALS = [
  { value: 'beef',       label: 'Beef' },
  { value: 'fish',       label: 'Fish' },
  { value: 'vegetarian', label: 'Vegetarian' },
]

function RSVPSection() {
  const ref = useRef(null)
  const [query, setQuery]         = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult]       = useState(null)
  // selections: { [guestId]: { attending: bool, meal: '' } }
  const [selections, setSelections] = useState({})
  const [submitted, setSubmitted]   = useState(null) // 'attending' | 'declined'
  const [notFound, setNotFound]     = useState(false)
  const [mealError, setMealError]   = useState(false)
  const [rsvpDeadline, setRsvpDeadline] = useState(null)
  const [rsvpLocked, setRsvpLocked]     = useState(false)

  useEffect(() => {
    getConfig().then(data => {
      if (data?.rsvp_deadline) setRsvpDeadline(formatDeadline(data.rsvp_deadline))
      setRsvpLocked(!!data?.rsvp_locked)
    })
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) return
    const ctx = gsap.context(() => {
      gsap.from('.rsvp-card', {
        scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true },
        y: 36, opacity: 0, duration: 0.9, ease: 'power3.out',
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    setNotFound(false)
    setResult(null)
    const { data } = await findGuest(query)
    setSearching(false)
    if (!data) { setNotFound(true); return }
    const guestList = [
      { id: 'primary', name: data.primary_guest_name },
      ...(data.party_members || []).map((m, i) => ({ id: `party_${i}`, name: m.name })),
    ]
    setResult({ guestId: data.id, household: data.household_name, salutation: data.salutation, guests: guestList })
  }

  const toggleAttending = (id) => {
    setMealError(false)
    setSelections(s => ({
      ...s,
      [id]: { attending: !s[id]?.attending, meal: s[id]?.meal || '' },
    }))
  }

  const setMeal = (id, meal) => {
    setMealError(false)
    setSelections(s => ({ ...s, [id]: { ...s[id], attending: true, meal } }))
  }

  const setNotes = (id, notes) => {
    setSelections(s => ({ ...s, [id]: { ...s[id], notes } }))
  }

  const handleConfirm = async () => {
    const attending = result?.guests.filter(g => selections[g.id]?.attending) || []
    if (attending.some(g => !selections[g.id]?.meal)) { setMealError(true); return }
    const primary = selections['primary'] || {}
    const partyGuests = result.guests.filter(g => g.id !== 'primary')
    await submitRSVP(result.guestId, {
      rsvp_status:          'attending',
      num_attending:        attending.length,
      primary_attending:    primary.attending || false,
      primary_meal_choice:  primary.meal || null,
      dietary_restrictions: primary.notes || null,
      party_members: partyGuests.map(g => ({
        name:          g.name,
        attending:     selections[g.id]?.attending || false,
        meal_choice:   selections[g.id]?.meal || null,
        dietary_notes: selections[g.id]?.notes || null,
      })),
    })
    setSubmitted('attending')
  }

  const handleDecline = async () => {
    await submitRSVP(result.guestId, {
      rsvp_status:      'declined',
      num_attending:    0,
      primary_attending: false,
      party_members:    (result.guests || []).filter(g => g.id !== 'primary').map(g => ({ name: g.name, attending: false })),
    })
    setSubmitted('declined')
  }

  if (submitted) {
    return (
      <section ref={ref} id="rsvp" className="scroll-mt-16 pt-10 pb-20 sm:pb-28">
        <div className="max-w-lg mx-auto px-6 text-center">
          <div className="rsvp-card bg-surface rounded-3xl p-12 border border-divider">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-6">
              <Heart className="h-7 w-7 text-primary" strokeWidth={2.2} />
            </div>
            {submitted === 'attending' ? (
              <>
                <h3 className="font-serif text-2xl font-medium text-ink mb-3">You're in.</h3>
                <p className="font-body text-muted leading-relaxed text-sm">We've got you. See you on March 27 in Laguna Beach.</p>
              </>
            ) : (
              <>
                <h3 className="font-serif text-2xl font-medium text-ink mb-3">We'll miss you.</h3>
                <p className="font-body text-muted leading-relaxed text-sm">Thank you for letting us know. We hope to celebrate with you another time.</p>
              </>
            )}
          </div>
        </div>
      </section>
    )
  }

  if (rsvpLocked) {
    return (
      <section ref={ref} id="rsvp" className="scroll-mt-16 pt-10 pb-20 sm:pb-28">
        <div className="max-w-lg mx-auto px-6 text-center">
          <div className="rsvp-card bg-surface rounded-3xl p-12 border border-divider">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-6">
              <Heart className="h-7 w-7 text-primary" strokeWidth={2.2} />
            </div>
            <h3 className="font-serif text-2xl font-medium text-ink mb-3">RSVPs are closed.</h3>
            <p className="font-body text-muted leading-relaxed text-sm">Thank you to everyone who responded. Please reach out to us directly with any questions.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section ref={ref} id="rsvp" className="scroll-mt-16 pt-10 pb-20 sm:pb-28">
      <div className="max-w-lg mx-auto px-6">
        <div className="text-center mb-12">
          <Send className="h-8 w-8 text-primary/40 mx-auto mb-4" strokeWidth={1.25} />
          <p className="font-subheading text-sm uppercase tracking-[0.26em] text-primary">Join Us</p>
          <div className="gold-line w-24 mx-auto mt-6" />
          <p className="font-body text-muted text-sm mt-5">Kindly respond by {rsvpDeadline || COUPLE.rsvpDeadline}</p>
        </div>

        <div className="rsvp-card bg-surface rounded-3xl p-8 border border-divider">
          {!result && (
            <>
              <p className="font-serif text-base text-ink mb-5">Enter the name on your invitation.</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Your name…"
                  className="flex-1 bg-surface-2 border border-divider rounded-2xl px-5 py-3.5 font-body text-sm text-ink placeholder:text-muted/40 focus:outline-none focus:border-primary/40 transition-colors"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="magnetic-btn btn-outline-sharp flex items-center justify-center h-[50px] w-[50px] shrink-0 disabled:opacity-50"
                >
                  {searching
                    ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <Search className="h-4 w-4" strokeWidth={2.2} />
                  }
                </button>
              </div>

              {notFound && (
                <div className="mt-5 p-5 bg-surface-2 rounded-2xl border border-divider">
                  <p className="font-body text-sm text-muted leading-relaxed">
                    We couldn't find that name. Try it as it appears on your invitation.
                  </p>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="space-y-4">
              <p className="font-serif text-base text-ink mb-2">
                {result.salutation
                  ? `Welcome, ${result.salutation} ${result.guests[0]?.name.split(' ').pop()}.`
                  : `Welcome, ${result.guests[0]?.name.split(' ')[0]}.`
                } Who's joining us?
              </p>

              {result.guests.map(g => {
                const sel = selections[g.id] || {}
                return (
                  <div key={g.id} className={`rounded-2xl border-2 transition-all overflow-hidden ${
                    sel.attending ? 'border-primary' : 'border-divider'
                  }`}>
                    {/* Attending toggle */}
                    <button
                      onClick={() => toggleAttending(g.id)}
                      className={`flex items-center gap-3 w-full p-4 text-left transition-colors ${
                        sel.attending ? 'bg-primary/5' : 'bg-surface-2'
                      }`}
                    >
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        sel.attending ? 'border-primary bg-primary' : 'border-muted'
                      }`}>
                        {sel.attending && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className={`font-serif text-sm font-medium transition-colors ${sel.attending ? 'text-ink' : 'text-muted'}`}>
                        {g.name}
                      </span>
                    </button>

                    {/* Meal + notes — only when attending */}
                    {sel.attending && (
                      <div className="px-4 pb-4 pt-3 border-t border-divider/50 bg-primary/[0.02] space-y-3">
                        <div>
                          <p className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted mb-2.5">Meal preference</p>
                          <div className="flex gap-2">
                            {MEALS.map(m => (
                              <button
                                key={m.value}
                                onClick={() => setMeal(g.id, m.value)}
                                className={`flex-1 py-2 rounded-xl font-subheading text-[9px] uppercase tracking-[0.15em] border-2 transition-all ${
                                  sel.meal === m.value
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-divider text-muted hover:border-primary/40 hover:text-ink'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted mb-2">Allergies or dietary notes</p>
                          <input
                            type="text"
                            value={sel.notes || ''}
                            onChange={e => setNotes(g.id, e.target.value)}
                            placeholder="Optional"
                            className="w-full bg-surface border border-divider rounded-xl px-4 py-2.5 font-body text-xs text-ink placeholder:text-muted/30 focus:outline-none focus:border-primary/40 transition-colors"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {mealError && (
                <p className="font-body text-xs text-rose-400">Please select a meal for each attending guest.</p>
              )}

              <button
                onClick={handleConfirm}
                className="magnetic-btn ring-pulse btn-outline-sharp w-full py-4 font-serif text-base tracking-[0.05em]"
              >
                Confirm RSVP
              </button>

              <button
                onClick={handleDecline}
                className="w-full text-center font-body text-xs text-muted hover:text-ink transition-colors pt-1"
              >
                {result.guests.length === 1 ? "I can't make it" : "We can't make it"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
function FAQ() {
  const ref = useRef(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    if (prefersReducedMotion) return
    const ctx = gsap.context(() => {
      gsap.from('.faq-item', {
        scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true },
        y: 24, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out',
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={ref} id="faq" className="scroll-mt-16 pt-10 pb-20 sm:pb-28">
      <div className="max-w-2xl mx-auto px-6 sm:px-10">
        <div className="text-center mb-14">
          <MessageCircleQuestion className="h-8 w-8 text-primary/40 mx-auto mb-4" strokeWidth={1.25} />
          <p className="font-subheading text-sm uppercase tracking-[0.26em] text-primary">Questions</p>
          <div className="gold-line w-24 mx-auto mt-6" />
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="faq-item bg-surface rounded-2xl border border-divider overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-7 py-5 text-left"
              >
                <span className="font-serif text-base font-medium text-ink leading-snug">{item.q}</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted shrink-0 transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`}
                  strokeWidth={2.2}
                />
              </button>
              {open === i && (
                <div className="px-7 pb-6 border-t border-divider/60 pt-5">
                  <p className="font-body text-muted text-sm leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-deep border-t border-divider py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 text-center">
        <p className="font-script text-4xl sm:text-5xl gradient-text mb-2">Rod &amp; Paean</p>
        <p className="font-subheading text-[10px] uppercase tracking-[0.24em] text-white/20 mb-8">
          {COUPLE.dateLong} · {COUPLE.venue}
        </p>
        <div className="section-divider w-32 mx-auto mb-8" />
        <p className="font-subheading text-[9px] uppercase tracking-[0.2em] text-white/12 mt-2">
          Website by {COUPLE.brandName}
        </p>
      </div>
    </footer>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
function Site() {
  const [menuOpen, setMenuOpen] = useState(false)

  const scrollToSection = useCallback((id) => {
    // Close the menu first — closing it restores body overflow, and doing that mid-animation
    // aborts an in-flight smooth scroll, so the scroll itself has to start on the next frame.
    setMenuOpen(false)
    requestAnimationFrame(() => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.replaceState(null, '', id === 'home' ? '#' : `#${id}`)
    })
  }, [])

  // Deep links from invite emails look like `#rsvp?name=...` — strip the query suffix and jump there on load.
  useEffect(() => {
    const id = window.location.hash.replace('#', '').split('?')[0]
    if (TABS.find(t => t.id === id) && id !== 'home') {
      requestAnimationFrame(() => scrollToSection(id))
    }
  }, [scrollToSection])

  return (
    <div className="min-h-[100dvh] text-ink relative">
      {/* Fixed wallpaper layer */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0" style={{ backgroundImage: 'url(/wallpaper-topo.png)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />
      </div>

      {/* Page content */}
      <div className="relative z-10 min-h-[100dvh]">
        <div className="noise-overlay" aria-hidden />
        <Navbar scrollToSection={scrollToSection} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
        <MenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} scrollToSection={scrollToSection} />
        <main>
          <Hero scrollToSection={scrollToSection} />
          <RSVPSection />
          <EventDetails />
          <Travel />
          <RedEnvelopes />
          <FAQ />
        </main>
        <Footer />
      </div>
    </div>
  )
}

export default function App() {
  if (window.location.hash === '#admin') return <Admin />
  return <Site />
}
