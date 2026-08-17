// marketing/tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff7ff', 100: '#dceeff', 200: '#b9ddff', 300: '#86c4ff',
          400: '#4aa4f4', 500: '#2385df', 600: '#1268bd', 700: '#125395',
          800: '#144778', 900: '#163b63', 950: '#102946',
        },
        accent: {
          50: '#edfcf9', 100: '#d3f8f1', 200: '#acf0e5', 300: '#76e1d4',
          400: '#41c9bc', 500: '#26aea3', 600: '#198c85', 700: '#196f6b',
          800: '#195956', 900: '#194a48',
        },
        warm: { 50: '#fff9f4', 100: '#fff1e5', 200: '#ffdfc7', 500: '#ef7f5c', 600: '#dd6340' },
      },
      fontFamily: {
        sans: ['Manrope Variable', 'Avenir Next', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
