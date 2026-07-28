/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary:        '#C8836E',
        'primary-dark': '#A5614F',
        'primary-light':'#DEAF9F',
        mauve:          '#C49AAE',
        'mauve-dark':   '#A07A8C',
        accent:         '#B5172B',
        'accent-dark':  '#8C0D15',
        gold:           '#C9A052',
        'gold-dark':    '#A68038',
        background:     'rgba(38, 10, 22, 0.68)',
        surface:        'rgba(155, 65, 40, 0.58)',
        'surface-2':    'rgba(175, 85, 55, 0.48)',
        ink:            '#F2EDE4',
        muted:          '#F0CEB8',
        divider:        'rgba(255, 175, 135, 0.28)',
        deep:           'rgba(22, 6, 14, 0.94)',
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
