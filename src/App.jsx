import { useEffect, useRef, useState, useCallback } from 'react'
import Admin from './Admin.jsx'
import { findGuest, submitRSVP, getConfig } from './lib/supabase.js'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  Heart, Plane, Building,
  ExternalLink, ChevronDown, ChevronLeft, Check, Search,
  CalendarHeart, Compass, Send, HandHeart, MessageCircleQuestion,
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
  { time: '5:00 pm',   event: 'Ceremony',           location: 'ocean lawn',     iconSrc: '/icon-ceremony.svg', iconClass: 'h-11' },
  { time: 'following', event: 'Cocktail Reception', location: 'pacific lawn',   iconSrc: '/icon-cocktail.svg' },
  { time: 'evening',   event: 'Dinner & Dancing',   location: 'grand ballroom', iconSrc: '/icon-disco.svg' },
]

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

// ─── Active section tracking (mobile menu highlight + bottom RSVP bar) ────────
function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActive(entry.target.id)
        })
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    )
    const els = ids.map(id => document.getElementById(id)).filter(Boolean)
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return active
}

// ─── Scroll progress (mobile progress line) ────────────────────────────────────
function useScrollProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight
        setProgress(scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return progress
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ scrollToSection, menuOpen, setMenuOpen }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 w-full h-16 flex items-center justify-between px-6 sm:px-10 bg-deep border-b border-divider">
      <button
        onClick={() => scrollToSection('home')}
        className="font-serif text-sm sm:text-base tracking-[0.3em] text-ink/90 hover:text-white transition-colors"
        aria-label="Home"
      >
        R <span className="text-primary">&amp;</span> P
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
function MenuOverlay({ open, onClose, scrollToSection, activeSection }) {
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
            className={`lift-on-hover px-8 py-3 font-serif text-2xl sm:text-3xl transition-colors border-b ${
              tab.id === activeSection
                ? 'text-primary-light border-primary/40'
                : 'text-ink/85 hover:text-primary-light border-transparent hover:border-primary/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

// ─── Icon Divider ───────────────────────────────────────────────────────────────
// Plain thin line, same border color/opacity as the Hero's inset frame.
function IconDivider({ className = '' }) {
  return <div className={`w-20 mx-auto border-t border-primary/25 ${className}`} />
}

// ─── Scroll Progress Bar (mobile only) ─────────────────────────────────────────
function ScrollProgressBar({ progress }) {
  return (
    <div className="sm:hidden fixed top-16 left-0 right-0 z-40 h-[2px] bg-white/5">
      <div
        className="h-full transition-[width] duration-75 ease-out"
        style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #B84010, #E0B848)' }}
      />
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
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

function Hero({ scrollToSection }) {
  const ref = useRef(null)
  const { days, hours, minutes, seconds } = useCountdown(COUPLE.date)

  useEffect(() => {
    if (prefersReducedMotion) return
    const ctx = gsap.context(() => {
      gsap.from('.hero-name-1',   { y: 52, opacity: 0, duration: 1.2, delay: 0.4,  ease: 'power3.out' })
      gsap.from('.hero-monogram', { scale: 0.9, opacity: 0, duration: 1,   delay: 0.72, ease: 'power3.out' })
      gsap.from('.hero-name-2',   { y: 52, opacity: 0, duration: 1.2, delay: 0.9,  ease: 'power3.out' })
      gsap.from('.hero-date',     { y: 16, opacity: 0, duration: 0.8, delay: 1.15, ease: 'power3.out' })
      gsap.from('.hero-count',    { y: 16, opacity: 0, duration: 0.8, delay: 1.3,  ease: 'power3.out' })
      gsap.from('.hero-cta',      { y: 16, opacity: 0, duration: 0.8, delay: 1.45, ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={ref} id="home" className="relative min-h-[85dvh] sm:min-h-[100dvh] flex flex-col justify-center py-20 sm:py-24">
      {/* Full-bleed black & white photo backdrop — oversized and clipped so it reads "zoomed out" while still filling the frame */}
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <img src="/home-hero.jpg" alt="" className="h-full w-full object-cover object-top grayscale" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/60" />
      </div>

      {/* Inset frame — top offset clears the fixed navbar (h-16) plus the same margin used on the other sides */}
      <div className="absolute top-20 sm:top-24 right-4 sm:right-8 bottom-4 sm:bottom-8 left-4 sm:left-8 border border-primary/25 pointer-events-none" aria-hidden />

      <div className="relative max-w-3xl mx-auto w-full px-6 sm:px-10 text-center">
        <h1 className="leading-relaxed">
          <span className="hero-name-1 block font-serif uppercase text-4xl sm:text-5xl lg:text-6xl tracking-[0.2em] text-ink">
            {COUPLE.name1}
          </span>

          <div className="hero-monogram mx-auto my-6 sm:my-8 flex items-center justify-center">
            <span className="font-serif text-4xl sm:text-5xl text-primary">&amp;</span>
          </div>

          <span className="hero-name-2 block font-serif uppercase text-4xl sm:text-5xl lg:text-6xl tracking-[0.2em] silver-metallic">
            {COUPLE.name2}
          </span>
        </h1>

        <IconDivider className="my-8 sm:my-10" />

        <div className="hero-date">
          <p className="font-serif text-2xl sm:text-4xl text-ink tracking-wide">
            {COUPLE.dateLong} &middot; {SCHEDULE[0].time}
          </p>
          <p className="font-subheading text-[10px] sm:text-xs uppercase tracking-[0.25em] text-white/50 mt-3">
            {COUPLE.venue} &middot; {COUPLE.city}
          </p>
        </div>

        <div className="hero-count flex items-center justify-center gap-6 sm:gap-8 mt-8 sm:mt-10">
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

        <div className="hero-cta flex justify-center mt-8 sm:mt-10">
          <button
            onClick={() => scrollToSection('rsvp')}
            className="btn-frame-draw px-8 py-3 font-serif text-base tracking-[0.05em]"
          >
            <span className="btn-frame-draw-edge btn-frame-draw-left" />
            <span className="btn-frame-draw-edge btn-frame-draw-right" />
            <span className="btn-frame-draw-edge btn-frame-draw-top-left" />
            <span className="btn-frame-draw-edge btn-frame-draw-top-right" />
            <span className="btn-reveal-label">RSVP</span>
          </button>
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
      <div className="max-w-3xl lg:max-w-4xl mx-auto px-6 sm:px-10">
        <div className="text-center mb-14">
          <CalendarHeart className="h-8 w-8 text-primary/40 mx-auto mb-4" strokeWidth={1.25} />
          <p className="font-subheading text-sm uppercase tracking-[0.26em] text-primary">The Day</p>
          <IconDivider className="mt-3" />
        </div>

        <div className="event-card bg-surface rounded-xl px-8 py-7 border border-divider mb-5">
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
              className="btn-underline-draw shrink-0 inline-flex items-center gap-1.5 font-subheading text-xs uppercase tracking-[0.15em] text-primary mt-1"
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
              Plan to arrive 15 minutes before the ceremony begins. Valet parking is available at Montage, but we strongly recommend rideshare. Come, celebrate, get home safely.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 mb-5">
          {SCHEDULE.map((item, i) => (
            <div key={i} className="event-card bg-surface rounded-xl px-7 py-6 border border-divider text-center w-full max-w-xs">
              <img src={item.iconSrc} alt="" className={`${item.iconClass || 'h-16'} w-auto mx-auto mb-3 opacity-90`} />
              <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-primary mb-2">{item.event}</p>
              <p className="font-serif text-xl font-medium text-ink">{item.time}</p>
              <p className="font-body text-xs text-muted mt-0.5">{item.location}</p>
            </div>
          ))}
        </div>

        <div className="event-card bg-surface/50 rounded-xl px-6 py-5 border border-divider/60 mb-5">
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
          <IconDivider className="mt-3" />
        </div>

        {/* Stay With Us — Montage room block */}
        <div className="max-w-2xl lg:max-w-3xl mx-auto mb-6">
          <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-primary mb-4 text-center sm:text-right">Stay With Us</p>
          <div className="travel-card bg-surface rounded-xl p-8 border border-divider">
            <h3 className="font-serif text-xl font-medium text-ink mb-3">{COUPLE.venue}</h3>
            <p className="font-body text-sm text-muted leading-relaxed">
              We're holding a room block at {COUPLE.venue} — our wedding venue — so you can stay right where the celebration is happening. Rate, minimum-night requirement, and booking deadline to come.
            </p>
            <div className="mt-6 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-lg px-6 py-3 border border-divider text-muted/60 text-xs font-serif tracking-[0.03em] cursor-default">
                Booking Link Coming Soon
              </span>
            </div>
          </div>
        </div>

        {/* Alternate accommodations */}
        <div className="max-w-4xl lg:max-w-5xl mx-auto mb-10">
          <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-primary mb-4 text-center sm:text-left">Alternate Accommodations</p>
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-[10%] -mx-6 px-[10%] pb-2 no-scrollbar sm:grid sm:grid-cols-3 sm:gap-4 sm:mx-0 sm:px-0 sm:pb-0 sm:overflow-visible sm:scroll-px-0">
            {HOTELS.map((hotel, i) => (
              <div key={i} className="travel-card bg-surface rounded-xl p-6 border border-divider flex flex-col shrink-0 w-[80%] snap-center sm:w-auto sm:shrink">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mauve/10 mb-4">
                  <Building className="h-4 w-4 text-mauve" strokeWidth={2.2} />
                </div>
                <p className="font-subheading text-[9px] uppercase tracking-[0.16em] text-primary mb-1">{hotel.distance}</p>
                <h3 className="font-serif text-sm font-medium text-ink mb-1 leading-snug">{hotel.name}</h3>
                <p className="font-body text-xs text-muted mb-4 leading-relaxed flex-1">{hotel.note}</p>
                <a
                  href={hotel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-radial-fill btn-outline-sharp inline-flex items-center gap-1.5 px-4 py-2 text-xs font-serif tracking-[0.03em] self-center"
                >
                  View Hotel <ExternalLink className="h-3 w-3" strokeWidth={2.2} />
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-md lg:max-w-lg mx-auto">
          <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-primary mb-4 text-center">Nearest Airport</p>
          <div className="travel-card bg-surface rounded-xl p-7 border border-divider flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
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
      <div className="max-w-md lg:max-w-lg mx-auto px-6 text-center">
        <HandHeart className="h-8 w-8 text-primary/40 mx-auto mb-4" strokeWidth={1.25} />
        <p className="font-subheading text-sm uppercase tracking-[0.26em] text-primary">Gifts</p>
        <IconDivider className="mt-3 mb-10" />

        <div className="envelope-card red-envelope-glow rounded-xl border border-white/10 overflow-hidden text-left relative" style={{ background: 'rgba(48, 6, 12, 0.96)' }}>
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
  // selections: { [guestId]: { attending: bool | undefined, meal: '' } } — attending is
  // tri-state: undefined = unanswered, true/false = an explicit choice was made.
  const [selections, setSelections] = useState({})
  const [submitted, setSubmitted]   = useState(null) // 'attending' | 'declined'
  const [notFound, setNotFound]     = useState(false)
  const [mealError, setMealError]         = useState(false)
  const [attendanceError, setAttendanceError] = useState(false)
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

  const handleBack = () => {
    setResult(null)
    setSelections({})
    setQuery('')
    setNotFound(false)
    setMealError(false)
    setAttendanceError(false)
  }

  const setAttendance = (id, value) => {
    setAttendanceError(false)
    setMealError(false)
    setSelections(s => ({
      ...s,
      [id]: value
        ? { ...s[id], attending: true, meal: s[id]?.meal || '' }
        : { attending: false, meal: '', notes: '' },
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
    const allAnswered = result.guests.every(g => selections[g.id]?.attending !== undefined)
    if (!allAnswered) { setAttendanceError(true); return }
    setAttendanceError(false)

    const attending = result.guests.filter(g => selections[g.id]?.attending === true)
    if (attending.some(g => !selections[g.id]?.meal)) { setMealError(true); return }
    setMealError(false)

    const primary = selections['primary'] || {}
    const partyGuests = result.guests.filter(g => g.id !== 'primary')
    const anyAttending = attending.length > 0
    await submitRSVP(result.guestId, {
      rsvp_status:          anyAttending ? 'attending' : 'declined',
      num_attending:        attending.length,
      primary_attending:    primary.attending === true,
      primary_meal_choice:  primary.meal || null,
      dietary_restrictions: primary.notes || null,
      party_members: partyGuests.map(g => ({
        name:          g.name,
        attending:     selections[g.id]?.attending === true,
        meal_choice:   selections[g.id]?.meal || null,
        dietary_notes: selections[g.id]?.notes || null,
      })),
    })
    setSubmitted(anyAttending ? 'attending' : 'declined')
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
        <div className="max-w-lg lg:max-w-xl mx-auto px-6 text-center">
          <div className="rsvp-card bg-surface rounded-xl p-12 border border-divider">
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
        <div className="max-w-lg lg:max-w-xl mx-auto px-6 text-center">
          <div className="rsvp-card bg-surface rounded-xl p-12 border border-divider">
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
      <div className="max-w-lg lg:max-w-xl mx-auto px-6">
        <div className="text-center mb-12">
          <Send className="h-8 w-8 text-primary/40 mx-auto mb-4" strokeWidth={1.25} />
          <p className="font-subheading text-sm uppercase tracking-[0.26em] text-primary">Join Us</p>
          <IconDivider className="mt-3" />
          <p className="font-body text-muted text-sm mt-5">Kindly respond by {rsvpDeadline || COUPLE.rsvpDeadline}</p>
        </div>

        <div className="rsvp-card bg-surface rounded-xl p-8 border border-divider">
          {!result && (
            <>
              <p className="font-body text-base text-ink mb-5">Enter the name on your invitation.</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Your name…"
                  className="flex-1 bg-surface-2 border border-divider rounded-lg px-5 py-3.5 font-body text-sm text-ink placeholder:text-muted/40 focus:outline-none focus:border-primary/40 transition-colors"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="btn-radial-fill btn-outline-sharp flex items-center justify-center h-[50px] w-[50px] shrink-0 disabled:opacity-50"
                >
                  {searching
                    ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <Search className="h-4 w-4" strokeWidth={2.2} />
                  }
                </button>
              </div>

              {notFound && (
                <div className="mt-5 p-5 bg-surface-2 rounded-lg border border-divider">
                  <p className="font-body text-sm text-muted leading-relaxed">
                    We couldn't find that name. Try it as it appears on your invitation.
                  </p>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="space-y-4">
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-1 font-body text-xs text-muted hover:text-ink transition-colors -mt-2 mb-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.2} /> Back
              </button>

              <p className="font-body text-base text-ink mb-2">
                {result.salutation
                  ? `Welcome, ${result.salutation} ${result.guests[0]?.name.split(' ').pop()}.`
                  : `Welcome, ${result.guests[0]?.name.split(' ')[0]}.`
                } Who's joining us?
              </p>

              {result.guests.map(g => {
                const sel = selections[g.id] || {}
                return (
                  <div key={g.id} className={`rounded-lg border-2 transition-all overflow-hidden ${
                    sel.attending === true ? 'border-primary' : 'border-divider'
                  }`}>
                    <div className="p-4 bg-surface-2">
                      <p className="font-serif text-sm font-medium text-ink mb-3">{g.name}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAttendance(g.id, true)}
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md font-subheading text-[9px] uppercase tracking-[0.15em] border-2 transition-all ${
                            sel.attending === true
                              ? 'border-primary bg-primary text-white'
                              : 'border-divider text-muted hover:border-primary/40 hover:text-ink'
                          }`}
                        >
                          {sel.attending === true && <Check className="h-3 w-3" />} Attending
                        </button>
                        <button
                          onClick={() => setAttendance(g.id, false)}
                          className={`flex-1 py-2 rounded-md font-subheading text-[9px] uppercase tracking-[0.15em] border-2 transition-all ${
                            sel.attending === false
                              ? 'border-primary bg-primary text-white'
                              : 'border-divider text-muted hover:border-primary/40 hover:text-ink'
                          }`}
                        >
                          Not Attending
                        </button>
                      </div>
                    </div>

                    {/* Meal + notes — only when attending */}
                    {sel.attending === true && (
                      <div className="px-4 pb-4 pt-3 border-t border-divider/50 bg-primary/[0.02] space-y-3">
                        <div>
                          <p className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted mb-2.5">Meal preference</p>
                          <div className="flex gap-2">
                            {MEALS.map(m => (
                              <button
                                key={m.value}
                                onClick={() => setMeal(g.id, m.value)}
                                className={`flex-1 py-2 rounded-md font-subheading text-[9px] uppercase tracking-[0.15em] border-2 transition-all ${
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
                            className="w-full bg-surface border border-divider rounded-md px-4 py-2.5 font-body text-xs text-ink placeholder:text-muted/30 focus:outline-none focus:border-primary/40 transition-colors"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {attendanceError && (
                <p className="font-body text-xs text-rose-400">Please mark Attending or Not Attending for each guest.</p>
              )}
              {mealError && (
                <p className="font-body text-xs text-rose-400">Please select a meal for each attending guest.</p>
              )}

              <button
                onClick={handleConfirm}
                className="btn-frame-draw ring-pulse w-full py-4 font-serif text-base tracking-[0.05em]"
              >
                <span className="btn-frame-draw-edge btn-frame-draw-left" />
                <span className="btn-frame-draw-edge btn-frame-draw-right" />
                <span className="btn-frame-draw-edge btn-frame-draw-top-left" />
                <span className="btn-frame-draw-edge btn-frame-draw-top-right" />
                <span className="btn-reveal-label">Confirm RSVP</span>
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
      <div className="max-w-2xl lg:max-w-3xl mx-auto px-6 sm:px-10">
        <div className="text-center mb-14">
          <MessageCircleQuestion className="h-8 w-8 text-primary/40 mx-auto mb-4" strokeWidth={1.25} />
          <p className="font-subheading text-sm uppercase tracking-[0.26em] text-primary">Questions</p>
          <IconDivider className="mt-3" />
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="faq-item bg-surface rounded-xl border border-divider overflow-hidden">
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
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{ gridTemplateRows: open === i ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div className="px-7 pb-6 border-t border-divider/60 pt-5">
                    <p className="font-body text-muted text-sm leading-relaxed">{item.a}</p>
                  </div>
                </div>
              </div>
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
  const activeSection = useActiveSection(TABS.map(t => t.id))
  const scrollProgress = useScrollProgress()

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
        <ScrollProgressBar progress={scrollProgress} />
        <MenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} scrollToSection={scrollToSection} activeSection={activeSection} />
        <main>
          <Hero scrollToSection={scrollToSection} />
          <div className="relative">
            {/* Continuous wash, not a per-section tint — darkest right under Hero,
                easing to plain wallpaper through the middle, darkening again near the
                end. Sized to this wrapper's full content height so it isn't tied to any
                single section's height. */}
            <div
              className="absolute inset-0 -z-10 pointer-events-none"
              aria-hidden
              style={{
                background: `linear-gradient(
                  to bottom,
                  rgba(20,4,7,0.7) 0%,
                  rgba(20,4,7,0.25) 12%,
                  transparent 32%,
                  transparent 68%,
                  rgba(20,4,7,0.25) 88%,
                  rgba(20,4,7,0.6) 100%
                )`,
              }}
            />
            <RSVPSection />
            <EventDetails />
            <Travel />
            <RedEnvelopes />
            <FAQ />
          </div>
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
