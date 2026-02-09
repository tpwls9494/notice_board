/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f8f7f4',
          100: '#f0ede6',
          200: '#e2ddd0',
          300: '#cfc7b4',
          400: '#b8ac94',
          500: '#a5967b',
          600: '#98876c',
          700: '#7f6f5b',
          800: '#685b4d',
          900: '#564b41',
          950: '#2e2721',
        },
        paper: {
          50: '#fdfcfa',
          100: '#faf8f3',
          200: '#f5f1e8',
          300: '#ede7d9',
          400: '#e0d6c2',
        },
        accent: {
          DEFAULT: '#c2410c',
          light: '#ea580c',
          dark: '#9a3412',
          glow: '#fff7ed',
        },
        slate: {
          850: '#1a2332',
          950: '#0c1220',
        },
      },
      fontFamily: {
        display: ['"Noto Serif KR"', 'Georgia', 'serif'],
        body: ['"Pretendard"', '"Noto Sans KR"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(46, 39, 33, 0.07), 0 10px 20px -2px rgba(46, 39, 33, 0.04)',
        'soft-lg': '0 10px 40px -10px rgba(46, 39, 33, 0.12), 0 4px 25px -5px rgba(46, 39, 33, 0.05)',
        'warm': '0 4px 20px rgba(194, 65, 12, 0.08)',
        'card': '0 1px 3px rgba(46, 39, 33, 0.06), 0 1px 2px rgba(46, 39, 33, 0.04)',
        'card-hover': '0 10px 30px -5px rgba(46, 39, 33, 0.1), 0 4px 10px -3px rgba(46, 39, 33, 0.05)',
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
