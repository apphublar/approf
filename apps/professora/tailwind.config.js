/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gd: '#1B4332',
        gm: '#4F8341',
        gl: '#83C451',
        gp: '#C2E8A0',
        gbg: '#FDFAF6',
        cream: '#FDFAF6',
        ink: '#1A1A1A',
        soft: '#4A4A4A',
        muted: '#9A9A9A',
        border: '#D4EBC8',
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        chalk: ['Caveat', 'cursive'],
      },
      borderRadius: {
        app: '16px',
        'app-sm': '10px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(27,67,50,0.08)',
        md: '0 4px 20px rgba(27,67,50,0.10), 0 2px 6px rgba(27,67,50,0.06)',
        fab: '0 4px 16px rgba(79,131,65,0.38)',
      },
    },
  },
  plugins: [],
}
