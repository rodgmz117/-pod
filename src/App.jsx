import { useEffect, useRef, useState, useCallback } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  Heart, MapPin, Clock, Music, Plane, Building,
  ExternalLink, Mail, X, Car,
  ChevronDown, Check, Search,
} from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

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

const STORY_MILESTONES = [
  {
    year: 'Junior Year',
    title: 'The Tenth Choice',
    text: "Rod needed an elective. Theatre was at the bottom of the list — literally the tenth option. He signed up anyway. Paean was already there, front row, script in hand. He didn't tell her it was an accident for years.",
    img: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800&q=80&fit=crop',
  },
  {
    year: 'The Years Between',
    title: 'Always in the Orbit',
    text: "Life does what it does. Different cities, different chapters. But some people stay in your orbit no matter how far you drift — the ones who feel like home the moment they're back in the room.",
    img: 'https://images.unsplash.com/photo-1530268729831-4b0b9e170218?w=800&q=80&fit=crop',
  },
  {
    year: '15 Years Later',
    title: 'Healdsburg',
    text: "Sonoma County. A weekend that started with wine and ended with a question. Paean said yes before Rod could finish asking. Fifteen years of showing up for each other had already answered it long before that moment in the vineyard.",
    img: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80&fit=crop',
  },
]

const SCHEDULE = [
  { time: '5:00 PM',   event: 'Arrive & Valet',   location: 'Main Entrance, Montage' },
  { time: '5:00 PM',   event: 'Ceremony',          location: 'Outdoors on the Lawn' },
  { time: 'Following', event: 'Cocktail Hour',     location: 'Outdoor Terrace' },
  { time: 'Evening',   event: 'Dinner',            location: 'Outdoor Lawn' },
  { time: 'Late',      event: 'Dancing',           location: '— and the rest of the night' },
]

const HOTELS = [
  {
    name: 'Le Petit Pali Laguna Beach',
    distance: '~650 ft',
    note: 'Literally across Coast Hwy from Montage',
    url: 'https://lepetitpali.com',
  },
  {
    name: 'The Ranch at Laguna Beach',
    distance: '~1.5 miles',
    note: 'Tucked into the canyon — deeply Laguna',
    url: 'https://theranchlb.com',
  },
  {
    name: 'Laguna Cliffs Marriott Resort & Spa',
    distance: '~8 miles (Dana Point)',
    note: 'Clifftop resort, easy rideshare distance',
    url: 'https://marriott.com/hotels/travel/lgamc-laguna-cliffs-marriott-resort-and-spa/',
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
    q: "Can I take photos?",
    a: "Please put your phone away during the ceremony. We want you fully present. After that, the night is yours — just look up from the screen sometimes.",
  },
  {
    q: "What does Black Tie Optional actually mean?",
    a: "You don't have to wear a tux — but attire should be on the formal side. Think dark suits, floor-length gowns, or elegant midi dresses. Save the sundresses and anything spring-casual for another occasion. If you're unsure whether it's too dressed down, it probably is.",
  },
  {
    q: "Open bar?",
    a: "Yes. See the first answer.",
  },
  {
    q: "What time does it end?",
    a: "Midnight.",
  },
]

const TABS = [
  { id: 'home',    label: 'Home' },
  { id: 'story',   label: 'Our Story' },
  { id: 'details', label: 'Details' },
  { id: 'travel',  label: 'Travel' },
  { id: 'gifts',   label: 'Gifts' },
  { id: 'rsvp',    label: 'RSVP' },
  { id: 'faq',     label: 'FAQ' },
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
function Navbar({ isHome, setActiveTab }) {
  return (
    <nav className="relative w-full h-16 flex items-center justify-center bg-transparent z-50">
      <button
        onClick={() => setActiveTab('home')}
        className="group flex items-center justify-center"
        aria-label="Home"
      >
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary transition-transform duration-200 group-hover:scale-105">
          <span className="font-serif italic text-white text-sm">{COUPLE.initials}</span>
          <span className={`absolute inset-0 rounded-full ring-2 transition-colors duration-200 ${
            isHome ? 'ring-white/25 group-hover:ring-white/45' : 'ring-primary/25 group-hover:ring-primary/40'
          }`} />
        </span>
      </button>
    </nav>
  )
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
function TabBar({ activeTab, isHome, setActiveTab }) {
  return (
    <div className="sticky top-0 z-40 transition-all duration-300 bg-deep/60 backdrop-blur-md border-b border-white/8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-center overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 sm:px-5 py-[14px] font-mono text-[10px] uppercase tracking-[0.2em] border-b-2 transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-light text-white'
                  : 'border-transparent text-white/45 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ setActiveTab }) {
  const ref = useRef(null)
  const { days, hours, minutes, seconds } = useCountdown(COUPLE.date)

  useEffect(() => {
    if (prefersReducedMotion) return
    const ctx = gsap.context(() => {
      gsap.from('.hero-eyebrow', { y: 12, opacity: 0, duration: 0.8, delay: 0.3,  ease: 'power3.out' })
      gsap.from('.hero-name-1',  { y: 52, opacity: 0, duration: 1.2, delay: 0.5,  ease: 'power3.out' })
      gsap.from('.hero-name-2',  { y: 52, opacity: 0, duration: 1.2, delay: 0.65, ease: 'power3.out' })
      gsap.from('.hero-venue',   { y: 16, opacity: 0, duration: 0.8, delay: 0.85, ease: 'power3.out' })
      gsap.from('.hero-count',   { y: 16, opacity: 0, duration: 0.8, delay: 1.05, ease: 'power3.out' })
      gsap.from('.hero-cta',     { y: 16, opacity: 0, duration: 0.8, delay: 1.2,  ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={ref} className="relative h-[100dvh] overflow-hidden">
      <img
        src="https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1920&q=80&fit=crop"
        alt="Laguna Beach coast at dusk"
        className="absolute inset-0 h-full w-full object-cover scale-[1.02]"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-deep/80 via-deep/40 to-deep/70" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80" />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-deep/50 to-transparent" />

      {/* Floating botanical particles */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          {[...Array(14)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-drift"
              style={{
                left: `${5 + i * 6.5}%`,
                top: `${8 + (i % 6) * 10}%`,
                opacity: 0.12 + (i % 3) * 0.05,
                animationDelay: `${i * 0.6}s`,
                animationDuration: `${7 + (i % 4)}s`,
              }}
            >
              <svg width="7" height="13" viewBox="0 0 7 13">
                <ellipse
                  cx="3.5" cy="6.5" rx="2.2" ry="5"
                  fill={i % 3 === 0 ? '#C8836E' : i % 3 === 1 ? '#C49AAE' : '#C9A052'}
                  transform={`rotate(${-25 + i * 10} 3.5 6.5)`}
                />
              </svg>
            </div>
          ))}
        </div>
      )}

      <div className="absolute inset-0 flex flex-col justify-end pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto w-full px-6 sm:px-10 lg:px-16">
          <p className="hero-eyebrow font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/40 mb-6">
            {COUPLE.dateLong}&nbsp;&nbsp;·&nbsp;&nbsp;{COUPLE.city}
          </p>

          <h1 className="leading-[0.88] tracking-tight">
            <span className="hero-name-1 block font-script text-[4.5rem] sm:text-[7.5rem] lg:text-[10rem] text-ink/90">
              {COUPLE.name1}
            </span>
            <span className="hero-name-2 block font-script text-[4.5rem] sm:text-[7.5rem] lg:text-[10rem] gradient-text">
              {COUPLE.name2}
            </span>
          </h1>

          <p className="hero-venue font-serif italic text-base sm:text-lg text-white/35 font-light mt-4 sm:mt-5">
            {COUPLE.venue}
          </p>

          <div className="hero-count flex items-center gap-6 sm:gap-8 mt-7">
            {[
              { v: days,    l: 'Days' },
              { v: hours,   l: 'Hours' },
              { v: minutes, l: 'Min' },
              { v: seconds, l: 'Sec' },
            ].map(({ v, l }) => (
              <div key={l} className="text-center">
                <div className="font-serif text-3xl sm:text-4xl font-medium text-ink tabular-nums">
                  {String(v).padStart(2, '0')}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/30 mt-0.5">{l}</div>
              </div>
            ))}
          </div>

          <div className="hero-cta flex flex-wrap gap-3 mt-8 sm:mt-10">
            <button
              onClick={() => setActiveTab('rsvp')}
              className="magnetic-btn inline-flex items-center gap-2 bg-primary text-white px-7 py-3.5 rounded-full font-body font-semibold text-sm shadow-xl shadow-primary/20"
            >
              RSVP Now <Heart className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
            <button
              onClick={() => setActiveTab('story')}
              className="magnetic-btn inline-flex items-center gap-2 glass-dark text-white/80 px-7 py-3.5 rounded-full font-body font-semibold text-sm border border-white/12"
            >
              Our Story
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Our Story ────────────────────────────────────────────────────────────────
function OurStory() {
  const ref = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion) return
    const ctx = gsap.context(() => {
      gsap.from('.story-card', {
        scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true },
        y: 48, opacity: 0, duration: 0.9, stagger: 0.2, ease: 'power3.out',
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={ref} className="pt-10 pb-20 sm:pb-28">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="text-center mb-16 sm:mb-22">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-primary mb-4">The Beginning</p>
          <h2 className="font-serif text-4xl sm:text-6xl font-medium text-ink tracking-tight">How it started</h2>
          <div className="gold-line w-24 mx-auto mt-6" />
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-primary/12 -translate-x-1/2" />
          <div className="space-y-20 sm:space-y-28">
            {STORY_MILESTONES.map((m, i) => (
              <div
                key={i}
                className={`story-card relative grid lg:grid-cols-2 gap-10 sm:gap-16 items-center ${
                  i % 2 !== 0 ? 'lg:[direction:rtl]' : ''
                }`}
              >
                <div className={`[direction:ltr] ${i % 2 === 0 ? 'lg:pr-20' : 'lg:pl-20'}`}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60 mb-3">{m.year}</p>
                  <h3 className="font-serif text-2xl sm:text-3xl font-medium text-ink mb-4 leading-snug">{m.title}</h3>
                  <p className="font-body text-muted leading-relaxed text-base">{m.text}</p>
                </div>
                <div className={`[direction:ltr] ${i % 2 === 0 ? 'lg:pl-20' : 'lg:pr-20'}`}>
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-divider">
                    <img
                      src={m.img}
                      alt={m.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-700 brightness-[0.65]"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/20 ring-offset-4 ring-offset-background" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

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
    <section ref={ref} className="pt-10 pb-20 sm:pb-28">
      <div className="max-w-2xl mx-auto px-6 sm:px-10">
        <div className="text-center mb-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-primary mb-4">The Day</p>
          <h2 className="font-serif text-4xl sm:text-6xl font-medium text-ink tracking-tight">Event Details</h2>
          <div className="gold-line w-24 mx-auto mt-6" />
        </div>

        <div className="event-card bg-surface rounded-3xl px-8 py-7 border border-divider mb-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted mb-1.5">Venue</p>
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
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Dress Code</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink">{COUPLE.dressCode}</p>
            </div>
            <p className="font-body text-xs text-muted leading-relaxed">
              Tuxedos welcome, not required — but attire should be formal. Dark suits, floor-length or midi gowns. Save the sundresses for brunch.
            </p>
          </div>
        </div>

        <div className="event-card bg-surface rounded-3xl px-8 py-8 border border-divider mb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted mb-6">Schedule</p>
          <div className="divide-y divide-divider">
            {SCHEDULE.map((item, i) => (
              <div key={i} className="flex items-center gap-5 py-4 first:pt-0 last:pb-0">
                <span className="font-mono text-xs text-primary w-[5.5rem] shrink-0 tabular-nums">{item.time}</span>
                <div className="h-px w-3 bg-primary/20 shrink-0" />
                <div>
                  <p className="font-serif text-sm font-medium text-ink">{item.event}</p>
                  <p className="font-body text-xs text-muted mt-0.5">{item.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="event-card bg-surface/50 rounded-2xl px-6 py-5 border border-divider/60">
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
    <section ref={ref} className="pt-10 pb-20 sm:pb-28">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="text-center mb-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-primary mb-4">Getting Here</p>
          <h2 className="font-serif text-4xl sm:text-6xl font-medium text-ink tracking-tight">Travel &amp; Stay</h2>
          <div className="gold-line w-24 mx-auto mt-6" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <div className="travel-card bg-surface rounded-3xl p-8 border border-divider flex flex-col">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-5">
              <Plane className="h-5 w-5 text-primary" strokeWidth={2.2} />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Nearest Airport</p>
            <h3 className="font-serif text-lg font-medium text-ink mb-2">{COUPLE.airport}</h3>
            <p className="font-body text-sm text-muted leading-relaxed">{COUPLE.airportDistance}</p>
            <p className="font-body text-xs text-muted/60 mt-2">LAX is ~60 mi north — doable, worth planning around traffic.</p>
          </div>

          <div className="travel-card lg:col-span-2 grid sm:grid-cols-3 gap-4">
            {HOTELS.map((hotel, i) => (
              <div key={i} className="bg-surface rounded-3xl p-6 border border-divider flex flex-col">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mauve/10 mb-4">
                  <Building className="h-4 w-4 text-mauve" strokeWidth={2.2} />
                </div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary mb-1">{hotel.distance}</p>
                <h3 className="font-serif text-sm font-medium text-ink mb-1 leading-snug">{hotel.name}</h3>
                <p className="font-body text-xs text-muted mb-4 leading-relaxed flex-1">{hotel.note}</p>
                <a
                  href={hotel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="magnetic-btn inline-flex items-center gap-1.5 bg-surface-2 text-ink border border-divider px-4 py-2 rounded-full text-xs font-body font-medium hover:border-primary/40 transition-colors self-start"
                >
                  View Hotel <ExternalLink className="h-3 w-3" strokeWidth={2.2} />
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="travel-card bg-surface rounded-3xl p-8 border border-divider flex items-start gap-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Car className="h-5 w-5 text-primary" strokeWidth={2.2} />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Getting Around</p>
            <p className="font-body text-muted text-sm leading-relaxed">
              Valet parking is available at Montage, but we strongly recommend rideshare. The open bar is calling, PCH at midnight deserves your full attention, and Lyft is right there on your phone. Come, celebrate, get home safely.
            </p>
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
    <section ref={ref} className="pt-10 pb-20 sm:pb-28">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-accent/70 mb-4">A Tradition We Love</p>
        <h2 className="font-serif text-4xl sm:text-6xl font-medium text-ink tracking-tight mb-6">Red Envelopes</h2>
        <div className="section-divider w-24 mx-auto mb-10" />

        <div className="envelope-card red-envelope-glow bg-surface rounded-3xl border border-accent/20 overflow-hidden text-left">
          <div className="bg-accent px-8 py-10 relative overflow-hidden">
            <div className="absolute inset-0 opacity-8 pointer-events-none">
              <svg width="100%" height="100%" viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice">
                <path d="M0 0 L200 80 L400 0" fill="none" stroke="white" strokeWidth="0.5" />
                {[0,1,2,3,4].map(i => (
                  <circle key={i} cx={60 + i * 70} cy={30 + (i%2)*40} r="28" fill="none" stroke="white" strokeWidth="0.3" />
                ))}
              </svg>
            </div>
            <div className="relative text-center">
              <p className="font-script text-5xl sm:text-6xl text-white/85 mb-3">紅包</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-white/45">Hóng Bāo</p>
            </div>
          </div>

          <div className="px-8 py-10">
            <p className="font-body text-muted leading-relaxed text-base mb-5">
              We aren't registered anywhere. In place of a traditional gift, we warmly welcome red envelopes — a tradition meaningful to us and to Paean's family. A red envelope is a gift of good fortune and blessings for the new chapter ahead.
            </p>
            <p className="font-body text-muted/65 text-sm leading-relaxed">
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
function RSVPSection() {
  const ref = useRef(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState(null)
  const [selections, setSelections] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [notFound, setNotFound] = useState(false)

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
    await new Promise(r => setTimeout(r, 700))
    setSearching(false)
    setNotFound(true)
  }

  const toggle = (id) => setSelections(s => ({ ...s, [id]: !s[id] }))

  if (submitted) {
    return (
      <section ref={ref} className="pt-10 pb-20 sm:pb-28">
        <div className="max-w-lg mx-auto px-6 text-center">
          <div className="rsvp-card bg-surface rounded-3xl p-12 border border-divider">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-6">
              <Heart className="h-7 w-7 text-primary" strokeWidth={2.2} />
            </div>
            <h3 className="font-serif text-2xl font-medium text-ink mb-3">You're in.</h3>
            <p className="font-body text-muted leading-relaxed text-sm">We've got you. See you on March 27 in Laguna Beach.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section ref={ref} className="pt-10 pb-20 sm:pb-28">
      <div className="max-w-lg mx-auto px-6">
        <div className="text-center mb-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-primary mb-4">Join Us</p>
          <h2 className="font-serif text-4xl sm:text-6xl font-medium text-ink tracking-tight">RSVP</h2>
          <div className="gold-line w-24 mx-auto mt-6" />
          <p className="font-body text-muted text-sm mt-5">Kindly respond by {COUPLE.rsvpDeadline}</p>
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
                  className="magnetic-btn flex items-center justify-center h-[50px] w-[50px] shrink-0 bg-primary rounded-2xl text-white disabled:opacity-50"
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
            <div className="space-y-3">
              <p className="font-serif text-base text-ink mb-4">Welcome, {result.household}. Who's coming?</p>
              {result.guests.map(g => (
                <button
                  key={g.id}
                  onClick={() => toggle(g.id)}
                  className={`flex items-center gap-3 w-full p-4 rounded-2xl border-2 transition-all text-left ${
                    selections[g.id]
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-divider bg-surface-2 text-muted'
                  }`}
                >
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selections[g.id] ? 'border-primary bg-primary' : 'border-muted'
                  }`}>
                    {selections[g.id] && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="font-serif text-sm font-medium">{g.name}</span>
                </button>
              ))}
              <button
                onClick={() => setSubmitted(true)}
                className="magnetic-btn ring-pulse w-full bg-primary text-white py-4 rounded-2xl font-body font-semibold text-sm mt-2 shadow-lg shadow-primary/20"
              >
                Confirm RSVP
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
    <section ref={ref} className="pt-10 pb-20 sm:pb-28">
      <div className="max-w-2xl mx-auto px-6 sm:px-10">
        <div className="text-center mb-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-primary mb-4">Questions</p>
          <h2 className="font-serif text-4xl sm:text-6xl font-medium text-ink tracking-tight">FAQ</h2>
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
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/20 mb-8">
          {COUPLE.dateLong} · {COUPLE.venue}
        </p>
        <div className="section-divider w-32 mx-auto mb-8" />
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/12 mt-2">
          Website by {COUPLE.brandName}
        </p>
      </div>
    </footer>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
function getTabFromHash() {
  const hash = window.location.hash.replace('#', '')
  return TABS.find(t => t.id === hash) ? hash : 'home'
}

export default function App() {
  const [activeTab, setActiveTab] = useState(getTabFromHash)
  const isHome = activeTab === 'home'

  const goToTab = useCallback((tab) => {
    setActiveTab(tab)
    window.location.hash = tab
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      const tab = getTabFromHash()
      setActiveTab(tab)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const content = {
    home:    <Hero setActiveTab={goToTab} />,
    story:   <OurStory />,
    details: <EventDetails />,
    travel:  <Travel />,
    gifts:   <RedEnvelopes />,
    rsvp:    <RSVPSection />,
    faq:     <FAQ />,
  }

  return (
    <div className="min-h-[100dvh] text-ink relative">
      {/* Fixed wallpaper layer */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
        {/* Painted canvas wash — multiply tints into wine colorway */}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: '#7A2235',
            backgroundImage: 'url(/tex.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundBlendMode: 'multiply',
            opacity: 0.92,
          }}
        />
        {/* Unifying dark veil */}
        <div className="absolute inset-0" style={{ background: 'rgba(5, 0, 2, 0.10)' }} />
      </div>

      {/* Page content */}
      <div className="relative z-10 min-h-[100dvh]">
        <div className="noise-overlay" aria-hidden />
        <Navbar isHome={isHome} setActiveTab={goToTab} />
        <TabBar activeTab={activeTab} isHome={isHome} setActiveTab={goToTab} />
        <main>
          {content[activeTab]}
        </main>
        <Footer />
      </div>
    </div>
  )
}
