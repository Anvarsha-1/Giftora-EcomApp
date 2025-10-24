/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.ejs', // Scan EJS files in the views directory
    './public/**/*.html', // Scan HTML files in the public directory
    './src/**/*.{js,ts,jsx,tsx}', // Scan JS/TS files in the src directory
  ],
  safelist: [
    // Font Awesome classes (if used, though not directly in the provided HTML)
    'fas',
    'far',
    'fa-heart',

    // Background colors used in the HTML

    'bg-primary-dark',
    'bg-gray-50',
    'bg-gray-100',
    'bg-gray-200',
    'bg-gray-300',
    'bg-gray-400',
    'bg-gray-500',
    'bg-gray-600',
    'bg-gray-700',
    'bg-gray-800',
    'bg-white',
    'bg-primary',
    'bg-primary-dark',

    // Hover background colors
    'hover:bg-gray-50',
    'hover:bg-gray-300',
    'hover:bg-primary-dark',

    // Text colors
    'text-gray-400',
    'text-gray-500',
    'text-gray-600',
    'text-gray-700',
    'text-gray-800',
    'text-white',
    'text-red-500',
    'text-primary',

    // Border colors
    'border-gray-300',
    'border-transparent',
    'focus:ring-2',
    'focus:ring-primary',
    'focus:border-transparent',

    // Focus ring colors
    'focus:ring-primary',
    'focus:ring-2',

    // Padding classes
    'px-3',
    'px-4',
    'px-6',
    'py-1',
    'py-2',
    'py-3',
    'pl-8',
    'pl-10',
    'pr-4',

    // Margin classes
    'mb-2',
    'mb-3',
    'mb-4',
    'mb-6',
    'mb-8',
    'mt-0.25rem',

    // Font sizes
    'text-xs',
    'text-sm',
    'text-lg',
    'text-2xl',
    'font-medium',
    'font-bold',

    // Width and height
    'w-2',
    'w-4',
    'w-5',
    'w-8',
    'h-2',
    'h-4',
    'h-5',
    'h-8',
    'w-full',
    'max-w-4xl',
    'max-h-48',
    'min-h-screen',

    // Grid and flex
    'grid',
    'md:grid-cols-2',
    'md:grid-cols-3',
    'grid-cols-1',
    'flex',
    'gap-2',
    'gap-3',
    'gap-4',
    'gap-6',
    'items-center',
    'justify-end',

    // Rounded corners
    'rounded',
    'rounded-lg',
    'rounded-full',

    // Transitions
    'transition-all',

    // Overflow
    'overflow-y-auto',

    // Cursor
    'cursor-pointer',

    'sr-only', // For hidden inputs

    // Display
    'hidden',

    // Absolute positioning
    'absolute',
    'left-3',
    'right-3',
    'top-1/2',
    'transform',
    '-translate-y-1/2',

    // Screen reader only
    'sr-only',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1', // Matches bg-primary and text-primary
        'primary-dark': '#4f46e5', // Matches bg-primary-dark and hover:bg-primary-dark
      },
      borderRadius: {
        button: '0.375rem', // Matches Tailwind's default 'rounded' value
      },
    },
  },
  plugins: [],
};
