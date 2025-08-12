/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'oakmont-sage': '#636B56',
        'oakmont-brown': '#864936', 
        'oakmont-tan': '#B28354',
        'oakmont-cream': '#F8F2E7',
        'oakmont-black': '#000000',
        'oakmont-grey': '#1B1B1B',
      },
      fontFamily: {
        'forum': ['Forum', 'serif'],
        'avenir': ['Avenir', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce 2s infinite',
      },
      boxShadow: {
        'oakmont': '0 8px 25px rgba(99, 107, 86, 0.08)',
        'oakmont-lg': '0 12px 35px rgba(99, 107, 86, 0.12)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}