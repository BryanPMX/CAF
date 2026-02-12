// marketing/tailwind.config.cjs
// Updated palette: professional navy + aqua accents.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef6ff',
          100: '#d9e9ff',
          200: '#b8d4ff',
          300: '#89b9ff',
          400: '#5f97f2',
          500: '#3878d6',
          600: '#1f5eb3',
          700: '#17498d',
          800: '#143b72',
          900: '#112f5b',
        },
        accent: {
          400: '#7ee8d8',
          500: '#3dd8c3',
          600: '#17b7a5',
          700: '#0f8a7d',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
