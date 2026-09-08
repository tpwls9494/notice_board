/** @type {import('tailwindcss').Config} */
const colorVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: colorVar('--color-ink-50'),
          100: colorVar('--color-ink-100'),
          200: colorVar('--color-ink-200'),
          300: colorVar('--color-ink-300'),
          400: colorVar('--color-ink-400'),
          500: colorVar('--color-ink-500'),
          600: colorVar('--color-ink-600'),
          700: colorVar('--color-ink-700'),
          800: colorVar('--color-ink-800'),
          900: colorVar('--color-ink-900'),
          950: colorVar('--color-ink-950'),
        },
        paper: {
          50: colorVar('--color-paper-50'),
          100: colorVar('--color-paper-100'),
          200: colorVar('--color-paper-200'),
          300: colorVar('--color-paper-300'),
          400: colorVar('--color-paper-400'),
        },
        accent: {
          DEFAULT: colorVar('--color-accent'),
          light: colorVar('--color-accent-light'),
          dark: colorVar('--color-accent-dark'),
          glow: colorVar('--color-accent-glow'),
        },
      },
      fontFamily: {
        display: ['"Pretendard Variable"', '"Pretendard"', '"Malgun Gothic"', 'system-ui', 'sans-serif'],
        body: ['"Pretendard Variable"', '"Pretendard"', '"Malgun Gothic"', 'system-ui', 'sans-serif'],
        editorial: ['"Pretendard Variable"', '"Pretendard"', '"Malgun Gothic"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.04), 0 10px 20px -2px rgba(0, 0, 0, 0.02)',
        'soft-lg': '0 10px 40px -10px rgba(0, 0, 0, 0.06), 0 4px 25px -5px rgba(0, 0, 0, 0.03)',
        'warm': '0 4px 20px rgba(0, 0, 0, 0.04)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 10px 30px -5px rgba(0, 0, 0, 0.06), 0 4px 10px -3px rgba(0, 0, 0, 0.03)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      borderRadius: {
        'xl': '0.875rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
