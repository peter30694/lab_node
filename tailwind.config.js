/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.{html,js}",
    "./template/**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: 'rgba(87, 181, 231, 1)',
        'primary-dark': 'rgba(67, 161, 211, 1)'
      },
      fontFamily: {
        'pacifico': ['Pacifico', 'cursive'],
        'roboto': ['Roboto', 'sans-serif']
      },
      borderRadius: {
        'button': '12px'
      }
    },
  },
  plugins: [],
} 