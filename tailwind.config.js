/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary:        '#B08085',
        'primary-dark': '#8C6068',
        'primary-light':'#CCA8AC',
        mauve:          '#C4A0A8',
        'mauve-dark':   '#A07880',
        accent:         '#8B6B50',
        'accent-dark':  '#6B5038',
        gold:           '#C4A055',
        'gold-dark':    '#A07838',
        background:     'rgba(15, 40, 25, 0.75)',
        surface:        'rgba(12, 35, 20, 0.78)',
        'surface-2':    'rgba(20, 50, 32, 0.65)',
        ink:            '#F2EDE4',
        muted:          '#B8D4C0',
        divider:        'rgba(120, 180, 140, 0.22)',
        deep:           'rgba(5, 18, 10, 0.95)',
      },
      fontFamily: {
        script:  ['"Pinyon Script"', 'cursive'],
        serif:   ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body:    ['"Lora"', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
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
