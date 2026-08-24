/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        orange: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        olive: {
          50: '#FBFAEF',
          100: '#F4F2D8',
          200: '#E8E5B0',
          300: '#D6D17F',
          400: '#C2BB55',
          500: '#A6A035',
          600: '#847F28',
          700: '#676422',
          800: '#524E20',
          900: '#43401F',
        },
        ink: {
          DEFAULT: '#0D0D0D',
          soft: '#262626',
          muted: '#525252',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.10)',
        cardHover: '0 4px 12px rgba(0,0,0,0.08), 0 16px 40px -8px rgba(0,0,0,0.14)',
        badge: '0 2px 6px rgba(0,0,0,0.10)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '60%': { opacity: '1', transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'pop-in': 'pop-in 0.4s ease-out both',
        'wiggle': 'wiggle 0.6s ease-in-out',
      },
    },
  },
  plugins: [],
};
