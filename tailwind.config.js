/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.ejs', // Ensure your EJS files are scanned for classes
    './public/**/*.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6', // Example: Tailwind's blue-500
        secondary: '#1D4ED8', // Example: Tailwind's blue-700
      },
      borderRadius: {
        button: '0.375rem', // Example for rounded-button
      },
    },
  },
  plugins: [],
};