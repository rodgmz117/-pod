import { useEffect, useRef, useState, useCallback } from 'react'
import Admin from './Admin.jsx'
import { findGuest, submitRSVP, getConfig } from './lib/supabase.js'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  Heart, Plane,
  ExternalLink, ChevronDown, ChevronLeft, Check, Search,
  CalendarHeart, Compass, Send, HandHeart, MessageCircleQuestion,
} from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)


const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const SITE_PASSWORD = import.meta.env.VITE_SITE_PASSWORD

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
  montageBookingUrl: 'https://book.passkey.com/event/51344247/owner/49640336/home',
  montageBookingDeadline: 'January 26, 2027',
}

const SCHEDULE = [
  { time: '5:00 pm',   event: 'Ceremony',           location: 'ocean lawn',     iconSrc: '/icon-ceremony.svg', iconClass: 'h-11' },
  { time: 'following', event: 'Cocktail Reception', location: 'pacific lawn',   iconSrc: '/icon-cocktail.svg' },
  { time: 'evening',   event: 'Dinner / Dancing',   location: 'grand ballroom', iconSrc: '/icon-disco.svg' },
]

const FAQ_ITEMS = [
  {
    q: "What's the parking situation?",
    a: "Valet is available at Montage, but we'd love for you to rideshare instead.",
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
    a: "You don't have to wear a tux — but attire should be on the formal side. Think dark suits, floor-length gowns, or elegant midi dresses. If you're unsure whether it's too dressed down, it probably is.",
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
  // Kept mounted for the close animation's duration after `open` goes false, instead of
  // unmounting instantly — a plain `if (!open) return null` gives a CSS transition/animation no
  // outgoing element to animate. Skips the delay entirely under prefers-reduced-motion, where it
  // should just close instantly.
  const [rendered, setRendered] = useState(open)
  const [closing, setClosing] = useState(false)
  // Drives the backdrop's opacity transition. A CSS `transition` only animates a *change* in
  // class after the element has painted once — mounting straight at opacity-100 gives it nothing
  // to animate from, so open would snap in instantly even though close (a real 100→0 class swap)
  // faded smoothly. Mount at opacity-0 (entered=false), then flip true a frame later so the
  // browser has already painted the starting state and the transition actually plays.
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (open) {
      setClosing(false)
      setRendered(true)
      setEntered(false)
      const raf = requestAnimationFrame(() => setEntered(true))
      return () => cancelAnimationFrame(raf)
    }
    if (!rendered) return
    if (prefersReducedMotion) {
      setRendered(false)
      return
    }
    // Both breakpoints animate now (mobile: drop down/up; desktop: right-side drawer — see
    // index.css), so the close-delay always applies here, just with a duration matched to
    // whichever one is actually playing.
    const isMobile = window.matchMedia('(max-width: 639px)').matches
    setClosing(true)
    const t = setTimeout(() => { setRendered(false); setClosing(false) }, isMobile ? 300 : 350)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!rendered) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [rendered])

  if (!rendered) return null

  return (
    <>
      {/* Mobile: single centered column, drops down from the navbar. */}
      <div
        className={`sm:hidden fixed inset-0 z-40 flex items-center justify-center ${closing ? 'menu-drop-out' : 'menu-drop-in'}`}
        style={{ background: 'rgba(14,4,6,0.97)' }}
        onClick={onClose}
      >
        <nav className="flex flex-col items-center gap-1" onClick={e => e.stopPropagation()}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => scrollToSection(tab.id)}
              className={`lift-on-hover px-8 py-3 font-serif text-2xl transition-colors border-b ${
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

      {/* Desktop: a drawer panel slides in from the right, over a dimming backdrop. Backdrop and
          drawer are siblings (not parent/child), so a click inside the drawer never bubbles into
          the backdrop's onClose — only the backdrop itself (or picking a nav link) closes it. */}
      <div
        className={`hidden sm:block fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${closing || !entered ? 'opacity-0' : 'opacity-100'}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`hidden sm:flex fixed top-0 right-0 z-40 h-full w-[380px] lg:w-[440px] items-center ${closing ? 'menu-drawer-out' : 'menu-drawer-in'}`}
        style={{ background: 'rgba(42,8,14,0.97)' }}
      >
        <nav className="flex flex-col items-start gap-2 pl-12 lg:pl-16">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => scrollToSection(tab.id)}
              className={`menu-link-underline text-left font-serif text-2xl lg:text-3xl transition-colors ${
                tab.id === activeSection ? 'is-active text-primary-light' : 'text-ink/85 hover:text-primary-light'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </>
  )
}

// ─── Icon Divider ───────────────────────────────────────────────────────────────
// Plain thin line, same border color/opacity as the Hero's inset frame.
function IconDivider({ className = '' }) {
  return <div className={`w-20 mx-auto border-t border-primary/25 ${className}`} />
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

  const rsvpButton = (
    <button
      onClick={() => scrollToSection('rsvp')}
      className="btn-frame-draw px-7 py-2 sm:px-8 sm:py-3 font-serif text-sm sm:text-base tracking-[0.05em]"
    >
      <span className="btn-frame-draw-edge btn-frame-draw-left" />
      <span className="btn-frame-draw-edge btn-frame-draw-right" />
      <span className="btn-frame-draw-edge btn-frame-draw-top-left" />
      <span className="btn-frame-draw-edge btn-frame-draw-top-right" />
      <span className="btn-reveal-label">RSVP</span>
    </button>
  )

  const namesOnly = (
    <h1 className="leading-relaxed">
      <span className="hero-name-1 block font-serif uppercase text-4xl sm:text-5xl lg:text-6xl tracking-[0.2em] text-ink">
        {COUPLE.name1}
      </span>

      <div className="hero-monogram mx-auto my-2 sm:my-8 flex items-center justify-center">
        <span className="font-serif text-3xl sm:text-5xl text-primary">&amp;</span>
      </div>

      <span className="hero-name-2 block font-serif uppercase text-4xl sm:text-5xl lg:text-6xl tracking-[0.2em] silver-metallic">
        {COUPLE.name2}
      </span>
    </h1>
  )

  const dateBlock = (
    <div className="hero-date">
      <p className="font-serif text-2xl sm:text-4xl text-ink tracking-wide">
        {COUPLE.dateLong} &middot; {SCHEDULE[0].time}
      </p>
      <p className="font-subheading text-[9px] sm:text-xs uppercase tracking-[0.1em] sm:tracking-[0.25em] text-white/50 mt-1.5 sm:mt-3">
        {COUPLE.venue} &middot; {COUPLE.city}
      </p>
    </div>
  )

  const countdownBlock = (
    <div className="hero-count flex items-center justify-center gap-5 sm:gap-8 mt-3 sm:mt-10">
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
          <div className="font-subheading text-[8px] sm:text-[9px] uppercase tracking-[0.22em] text-white/30 mt-0.5">{l}</div>
        </div>
      ))}
    </div>
  )

  return (
    <section ref={ref} id="home" className="relative min-h-[100svh] flex flex-col py-12 sm:py-24 sm:justify-center">
      {/* Full-bleed photo, both breakpoints — mobile crop is the "hands closer" edit (object-center already
          reads as both hands + dress, no custom object-position needed). `svh` (not `dvh`): `dvh`
          recalculates continuously as iOS Safari's address bar collapses/expands during scroll, which
          visibly resized/rezoomed the photo the instant scrolling started — `svh` is fixed, can't jump.
          See gotcha in project memory. */}
      <div className="absolute inset-0 -z-10 overflow-hidden bg-black" aria-hidden>
        <img src="/home-hero-mobile.jpg" alt="" className="h-full w-full object-cover object-center grayscale sm:hidden" />
        <img src="/home-hero.jpg" alt="" className="hidden h-full w-full object-cover object-top grayscale sm:block" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />
      </div>

      {/* Inset frame — top offset clears the fixed navbar (h-16) plus the same margin used on the other sides */}
      <div className="absolute top-20 sm:top-24 right-4 sm:right-8 bottom-4 sm:bottom-8 left-4 sm:left-8 border border-primary/25 pointer-events-none" aria-hidden />

      {/* Mobile: content block centers itself in the section via flex-1 (section already handles
          centering on its own for sm:). pt-16 shifts the centered position down by half the fixed
          navbar's height (h-16) — the navbar visually obscures the section's own top 64px, so
          centering against the section's full (nav-included) height put the content noticeably
          higher than the actual visible area's true center. */}
      <div className="flex-1 flex flex-col justify-center pt-16 sm:flex-none sm:block sm:pt-0">
        <div className="relative max-w-3xl mx-auto w-full px-6 sm:px-10 text-center">
          {namesOnly}
          <IconDivider className="my-3 sm:my-10" />
          {dateBlock}
          {countdownBlock}

          <div className="hero-cta flex justify-center mt-6 sm:mt-10">{rsvpButton}</div>
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

        <div className="event-card bg-deep rounded-none shadow-lg shadow-black/30 mb-5 overflow-hidden">
          <div className="px-6 sm:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6 py-7 border-b border-divider">
              <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-muted shrink-0 sm:w-32">Venue</p>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-serif text-2xl font-medium text-ink">{COUPLE.venue}</h3>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 font-subheading text-[10px] uppercase tracking-[0.15em] text-primary hover:opacity-70 transition-opacity mt-1.5"
                  >
                    Directions <ExternalLink className="h-3 w-3" strokeWidth={2.2} />
                  </a>
                </div>
                <p className="font-body text-sm text-muted mt-1.5">{COUPLE.address}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6 py-7 border-b border-divider">
              <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-muted shrink-0 sm:w-32">Dress Code</p>
              <div>
                <h3 className="font-serif text-2xl font-medium text-ink">{COUPLE.dressCode}</h3>
                <p className="font-body text-sm text-muted leading-relaxed mt-1.5">
                  Tuxedos welcome, not required — but attire should be formal. Dark suits, floor-length or midi gowns.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6 py-7 border-b border-divider">
              <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-muted shrink-0 sm:w-32">Getting Here</p>
              <p className="font-body text-sm text-muted leading-relaxed">
                Plan to arrive 15 minutes before the ceremony begins. Valet parking is available at Montage, but we strongly recommend rideshare — come, celebrate, get home safely.
              </p>
            </div>
          </div>

          <div className="px-6 sm:px-8" style={{ background: 'rgba(30, 9, 13, 0.95)' }}>
            <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-primary pt-7 pb-1">The Evening</p>
            {SCHEDULE.map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 sm:gap-6 py-6 ${i < SCHEDULE.length - 1 ? 'border-b border-divider' : ''}`}
              >
                <div className="flex items-center gap-3 shrink-0">
                  <div className="h-6 w-6 sm:h-7 sm:w-7 shrink-0 flex items-center justify-center">
                    <img src={item.iconSrc} alt="" className="max-h-full max-w-full w-auto h-auto object-contain" />
                  </div>
                  <p className={`font-serif text-lg sm:text-xl text-primary w-14 sm:w-16 ${/\d/.test(item.time) ? '' : 'italic'}`}>
                    {item.time}
                  </p>
                </div>
                <h3 className="font-serif text-2xl font-medium text-ink flex-1 min-w-0">{item.event}</h3>
                <span className="font-body text-sm sm:text-base italic text-muted shrink-0">{item.location}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="font-body text-sm text-muted leading-relaxed text-center italic px-4">
          The ceremony and cocktail hour are outdoors on the grass. Laguna Beach in late March is typically 60–65°F by evening — bring a wrap if you run cold.
        </p>

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
        <div className="max-w-3xl lg:max-w-4xl mx-auto mb-10">
          <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-primary mb-4 text-center sm:text-right">Stay With Us</p>
          <div className="travel-card bg-[rgba(30,9,13,0.95)] rounded-none shadow-lg shadow-black/30 overflow-hidden flex flex-col sm:flex-row">
            <img src="/montage-stay-v2.jpg" alt={COUPLE.venue} className="w-full sm:w-1/2 sm:order-2 aspect-[4/3] object-cover object-[center_0%] shrink-0" />
            <div className="p-8 flex flex-col justify-center sm:order-1">
              <h3 className="font-serif text-xl font-medium text-ink mb-3 text-center sm:text-left">{COUPLE.venue}</h3>
              <p className="font-body text-sm text-muted leading-relaxed">
                We've secured a room block so you can stay right where the celebration is happening. Book by {COUPLE.montageBookingDeadline} to guarantee your rate.
              </p>
              <div className="mt-6 text-center">
                <a
                  href={COUPLE.montageBookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-frame-draw inline-flex items-center px-6 py-3 text-xs font-serif tracking-[0.03em]"
                >
                  <span className="btn-frame-draw-edge btn-frame-draw-left" />
                  <span className="btn-frame-draw-edge btn-frame-draw-right" />
                  <span className="btn-frame-draw-edge btn-frame-draw-top-left" />
                  <span className="btn-frame-draw-edge btn-frame-draw-top-right" />
                  <span className="btn-reveal-label gap-1.5">Book Your Room <ExternalLink className="h-3 w-3" strokeWidth={2.2} /></span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-md lg:max-w-lg mx-auto">
          <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-primary mb-4 text-center">Nearest Airport</p>
          <div className="travel-card bg-[rgba(30,9,13,0.95)] rounded-none p-7 shadow-lg shadow-black/30 flex flex-col items-center text-center gap-4 sm:flex-row sm:items-start sm:text-left">
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

        <div className="envelope-card rounded-none shadow-lg shadow-black/30 overflow-hidden relative" style={{ background: 'rgba(30, 9, 13, 0.95)' }}>
          <div className="px-8 py-10 relative">
            <p className="font-body text-muted leading-relaxed text-sm">
              Keeping with tradition — red envelopes are welcomed in lieu of a gift registry.
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  const [email, setEmail]           = useState('')
  const [mealError, setMealError]         = useState(false)
  const [attendanceError, setAttendanceError] = useState(false)
  const [emailError, setEmailError]       = useState(false)
  const [nameError, setNameError]         = useState(false)
  const [guestNames, setGuestNames]       = useState({}) // per-id typed name, for plus-ones the couple hasn't named yet
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

  useEffect(() => {
    if (!submitted) return
    ref.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' })
  }, [submitted])

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
      ...(data.party_members || []).map((m, i) => ({ id: `party_${i}`, name: m.name, needsName: !!m.needsName })),
    ]

    const hasResponded = data.rsvp_status === 'attending' || data.rsvp_status === 'declined'
    const priorSelections = {}
    const priorNames = {}
    if (hasResponded) {
      priorSelections.primary = {
        attending: !!data.primary_attending,
        meal: data.primary_meal_choice || '',
        notes: data.dietary_restrictions || '',
      }
      ;(data.party_members || []).forEach((m, i) => {
        priorSelections[`party_${i}`] = {
          attending: !!m.attending,
          meal: m.meal_choice || '',
          notes: m.dietary_notes || '',
        }
        if (m.name) priorNames[`party_${i}`] = m.name
      })
    }
    setSelections(priorSelections)
    setGuestNames(priorNames)
    setEmail(data.email || '')

    setResult({ guestId: data.id, household: data.household_name, guests: guestList, hasResponded })
  }

  const handleBack = () => {
    setResult(null)
    setSelections({})
    setGuestNames({})
    setQuery('')
    setNotFound(false)
    setEmail('')
    setMealError(false)
    setAttendanceError(false)
    setEmailError(false)
    setNameError(false)
  }

  const setGuestName = (id, name) => {
    setNameError(false)
    setGuestNames(n => ({ ...n, [id]: name }))
  }

  const setAttendance = (id, value) => {
    setAttendanceError(false)
    setMealError(false)
    // If the primary guest declines, the rest of the party can't attend without them —
    // decline everyone else in the same submission too.
    if (id === 'primary' && value === false) {
      setSelections(s => {
        const next = { ...s, primary: { attending: false, meal: '', notes: '' } }
        result.guests.forEach(g => {
          if (g.id !== 'primary') next[g.id] = { attending: false, meal: '', notes: '' }
        })
        return next
      })
      return
    }
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

    if (attending.some(g => g.needsName && !(guestNames[g.id] || '').trim())) { setNameError(true); return }
    setNameError(false)

    const anyAttending = attending.length > 0
    // Nobody's coming — no need to make them give an email to say so.
    if (anyAttending && !EMAIL_RE.test(email.trim())) { setEmailError(true); return }
    setEmailError(false)

    const primary = selections['primary'] || {}
    const partyGuests = result.guests.filter(g => g.id !== 'primary')
    await submitRSVP(result.guestId, {
      email:                 email.trim() || null,
      rsvp_status:          anyAttending ? 'attending' : 'declined',
      num_attending:        attending.length,
      primary_attending:    primary.attending === true,
      primary_meal_choice:  primary.meal || null,
      dietary_restrictions: primary.notes || null,
      party_members: partyGuests.map(g => {
        const name = g.needsName ? (guestNames[g.id] || '').trim() : g.name
        return {
          name,
          needsName:     g.needsName && !name,
          attending:     selections[g.id]?.attending === true,
          meal_choice:   selections[g.id]?.meal || null,
          dietary_notes: selections[g.id]?.notes || null,
        }
      }),
    })
    setSubmitted(anyAttending ? 'attending' : 'declined')
  }

  const handleEditRSVP = () => {
    setSubmitted(null)
    setResult(r => r ? { ...r, hasResponded: true } : r)
  }

  if (submitted) {
    return (
      <section ref={ref} id="rsvp" className="scroll-mt-16 pt-10 pb-20 sm:pb-28">
        <div className="max-w-lg lg:max-w-xl mx-auto px-6 text-center">
          <div className="rsvp-card bg-[rgba(30,9,13,0.95)] rounded-none p-12 shadow-lg shadow-black/30">
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
            {!rsvpLocked && (
              <button
                onClick={handleEditRSVP}
                className="mt-6 font-body text-xs text-muted hover:text-ink transition-colors underline underline-offset-4"
              >
                Edit RSVP
              </button>
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
          <div className="rsvp-card bg-[rgba(30,9,13,0.95)] rounded-none p-12 shadow-lg shadow-black/30">
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

        <div className="rsvp-card bg-[rgba(30,9,13,0.95)] rounded-none p-8 shadow-lg shadow-black/30">
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
                  className="btn-frame-draw flex items-center justify-center h-[50px] w-[50px] shrink-0 disabled:opacity-50"
                >
                  <span className="btn-frame-draw-edge btn-frame-draw-left" />
                  <span className="btn-frame-draw-edge btn-frame-draw-right" />
                  <span className="btn-frame-draw-edge btn-frame-draw-top-left" />
                  <span className="btn-frame-draw-edge btn-frame-draw-top-right" />
                  <span className="btn-reveal-label">
                    {searching
                      ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      : <Search className="h-4 w-4" strokeWidth={2.2} />
                    }
                  </span>
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
                Welcome, {result.guests[0]?.name.split(' ')[0]}. Who's joining us?
              </p>

              {result.hasResponded && (
                <p className="font-body text-xs text-muted -mt-1 mb-1">
                  You've already responded — here's what we have on file. Update anything below and confirm again.
                </p>
              )}

              {result.guests.map(g => {
                const sel = selections[g.id] || {}
                const isPrimary = g.id === 'primary'
                const lockedByPrimary = !isPrimary && selections.primary?.attending === false
                return (
                  <div key={g.id} className={`rounded-lg border-2 transition-all overflow-hidden ${
                    sel.attending === true ? 'border-primary' : 'border-divider'
                  } ${lockedByPrimary ? 'opacity-50' : ''}`}>
                    <div className="p-4 bg-surface-2">
                      {g.needsName ? (
                        <div className="mb-3">
                          <p className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted mb-2">Your plus-one</p>
                          <input
                            type="text"
                            value={guestNames[g.id] || ''}
                            onChange={e => setGuestName(g.id, e.target.value)}
                            placeholder="Guest's full name"
                            disabled={lockedByPrimary}
                            className="w-full bg-surface border border-divider rounded-md px-3 py-2 font-serif text-sm text-ink placeholder:text-muted/40 focus:outline-none focus:border-primary/40 transition-colors disabled:cursor-not-allowed"
                          />
                        </div>
                      ) : (
                        <p className="font-serif text-sm font-medium text-ink mb-3">{g.name}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAttendance(g.id, true)}
                          disabled={lockedByPrimary}
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md font-subheading text-[9px] uppercase tracking-[0.15em] border-2 transition-all ${
                            sel.attending === true
                              ? 'border-primary bg-primary text-white'
                              : 'border-divider text-muted hover:border-primary/40 hover:text-ink'
                          } ${lockedByPrimary ? 'cursor-not-allowed hover:border-divider hover:text-muted' : ''}`}
                        >
                          {sel.attending === true && <Check className="h-3 w-3" />} Attending
                        </button>
                        <button
                          onClick={() => setAttendance(g.id, false)}
                          disabled={lockedByPrimary}
                          className={`flex-1 py-2 rounded-md font-subheading text-[9px] uppercase tracking-[0.15em] border-2 transition-all ${
                            sel.attending === false
                              ? 'border-primary bg-primary text-white'
                              : 'border-divider text-muted hover:border-primary/40 hover:text-ink'
                          } ${lockedByPrimary ? 'cursor-not-allowed hover:border-divider hover:text-muted' : ''}`}
                        >
                          Not Attending
                        </button>
                      </div>
                      {lockedByPrimary && (
                        <p className="font-body text-[11px] text-muted mt-2">
                          Can't attend without {result.guests[0]?.name.split(' ')[0]}.
                        </p>
                      )}
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

              {result.guests.some(g => selections[g.id]?.attending === true) && (
                <div className="pt-2">
                  <p className="font-subheading text-[9px] uppercase tracking-[0.2em] text-muted mb-2">Email</p>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailError(false) }}
                    placeholder="you@example.com"
                    className="w-full bg-surface-2 border border-divider rounded-lg px-4 py-2.5 font-body text-sm text-ink placeholder:text-muted/30 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                  <p className="font-body text-xs text-muted mt-1.5">We'll use this to keep you posted on wedding details.</p>
                </div>
              )}

              {emailError && (
                <p className="font-body text-xs text-rose-400">Please enter a valid email address.</p>
              )}
              {attendanceError && (
                <p className="font-body text-xs text-rose-400">Please mark Attending or Not Attending for each guest.</p>
              )}
              {mealError && (
                <p className="font-body text-xs text-rose-400">Please select a meal for each attending guest.</p>
              )}
              {nameError && (
                <p className="font-body text-xs text-rose-400">Please enter your plus-one's name.</p>
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
            <div key={i} className="faq-item bg-[rgba(30,9,13,0.95)] rounded-none shadow-lg shadow-black/30 overflow-hidden">
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
        <p className="font-serif uppercase tracking-[0.2em] text-2xl sm:text-3xl mb-2">
          <span className="text-ink">{COUPLE.name1}</span> <span className="text-primary">&amp;</span>{' '}
          <span className="silver-metallic">{COUPLE.name2}</span>
        </p>
        <p className="font-subheading text-[10px] uppercase tracking-[0.24em] text-white/20 mb-8">
          {COUPLE.dateLong} · {COUPLE.venue}
        </p>
        <IconDivider className="mb-8" />
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
    } else {
      // No section to deep-link to — make sure we're actually at the top. Mobile
      // browsers sometimes restore a scroll position from a previous visit to this URL.
      window.scrollTo(0, 0)
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

function SiteGate({ children }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('site_authed') === '1')
  const [pw, setPw]         = useState('')
  const [pwError, setPwError] = useState(false)

  const unlock = () => {
    if (pw === SITE_PASSWORD) { sessionStorage.setItem('site_authed', '1'); setAuthed(true) }
    else setPwError(true)
  }

  if (authed) return children

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6" style={{ background: '#0E0406' }}>
      <div className="w-full max-w-sm">
        <p className="font-serif uppercase tracking-[0.2em] text-3xl text-center mb-8">
          <span className="text-ink">Rod</span> <span className="text-primary">&amp;</span> <span className="silver-metallic">Paean</span>
        </p>
        <div className="bg-surface rounded-3xl p-8 border border-divider">
          <p className="font-subheading text-[10px] uppercase tracking-[0.2em] text-muted mb-6 text-center">
            Enter Password
          </p>
          <input
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setPwError(false) }}
            onKeyDown={e => e.key === 'Enter' && unlock()}
            placeholder="Password"
            autoFocus
            className="w-full bg-surface-2 border border-divider rounded-2xl px-5 py-3.5 font-body text-sm text-ink placeholder:text-muted/40 focus:outline-none focus:border-primary/40 transition-colors mb-3"
          />
          {pwError && <p className="font-body text-xs text-rose-400 mb-3">Incorrect password.</p>}
          <button onClick={unlock} className="btn-frame-draw w-full py-3.5 font-serif text-base tracking-[0.05em]">
            <span className="btn-frame-draw-edge btn-frame-draw-left" />
            <span className="btn-frame-draw-edge btn-frame-draw-right" />
            <span className="btn-frame-draw-edge btn-frame-draw-top-left" />
            <span className="btn-frame-draw-edge btn-frame-draw-top-right" />
            <span className="btn-reveal-label">Enter</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  if (window.location.hash === '#admin') return <Admin />
  return (
    <SiteGate>
      <Site />
    </SiteGate>
  )
}
