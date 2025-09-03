/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.ejs',
    './public/**/*.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    "fas",
    "far",
    "fa-heart",
    'bg-yellow-500',
    'hover:bg-yellow-600',
    'text-white',
    'border-yellow-600',
    'px-3',
    'py-1',
    'text-xs',
    'rounded',
    'border-red-500',
    'text-red-500',
    'text-gray-400',
    
    'bg-orange-50', 'bg-orange-100', 'bg-orange-200', 'bg-orange-300', 'bg-orange-400',
    'bg-orange-500', 'bg-orange-600', 'bg-orange-700', 'bg-orange-800', 'bg-orange-900',
    // Yellow backgrounds
    'bg-yellow-50', 'bg-yellow-100', 'bg-yellow-200', 'bg-yellow-300', 'bg-yellow-400',
    'bg-yellow-500', 'bg-yellow-600', 'bg-yellow-700', 'bg-yellow-800', 'bg-yellow-900',
    // Hover states
    'hover:bg-orange-50', 'hover:bg-orange-100', 'hover:bg-orange-200', 'hover:bg-orange-300', 'hover:bg-orange-400',
    'hover:bg-orange-500', 'hover:bg-orange-600', 'hover:bg-orange-700', 'hover:bg-orange-800', 'hover:bg-orange-900',
    'hover:bg-yellow-50', 'hover:bg-yellow-100', 'hover:bg-yellow-200', 'hover:bg-yellow-300', 'hover:bg-yellow-400',
    'hover:bg-yellow-500', 'hover:bg-yellow-600', 'hover:bg-yellow-700', 'hover:bg-yellow-800', 'hover:bg-yellow-900'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        secondary: '#1D4ED8',
      },
      borderRadius: {
        button: '0.375rem',
      },
    },
  },
  plugins: [],
};
