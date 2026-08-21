/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary:        '#C46420',
        'primary-dark': '#A05018',
        'primary-light':'#D47830',
        amber:          '#D08828',
        'amber-dark':   '#A86818',
        silver:         '#B0B0C2',
        gold:           '#C4A055',
        'gold-dark':    '#A07838',
        background:     'rgba(50, 10, 20, 0.80)',
        surface:        'rgba(42, 8, 16, 0.82)',
        'surface-2':    'rgba(58, 14, 24, 0.72)',
        ink:            '#F2EDE4',
        muted:          '#C0A898',
        divider:        'rgba(196, 100, 32, 0.25)',
        deep:           'rgba(18, 4, 8, 0.96)',
      },
      fontFamily: {
        script:      ['"Pinyon Script"', 'cursive'],
        serif:       ['"Cormorant Garamond"', 'Georgia', 'serif'],
        display:     ['"Cormorant Garamond"', 'Georgia', 'serif'],
        subheading:  ['"Sweet Sans Pro"', 'sans-serif'],
        body:        ['"Karla"', 'sans-serif'],
        mono:        ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        '2.5xl': '1.25rem',
        '4xl':   '2rem',
        '5xl':   '2.5rem',
      },
      animation: {
        'float':      'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'blink':      'blink 1s step-end infinite',
        'sweep':      'sweep 3s ease-in-out infinite',
        'drift':      'drift 8s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        sweep: {
          '0%':   { transform: 'translateX(-100%)' },
          '50%':  { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        drift: {
          '0%, 100%': { transform: 'translateY(0) translateX(0) rotate(0deg)' },
          '33%':      { transform: 'translateY(-12px) translateX(6px) rotate(5deg)' },
          '66%':      { transform: 'translateY(-6px) translateX(-4px) rotate(-3deg)' },
        },
      },
    },
  },
  plugins: [],
}
