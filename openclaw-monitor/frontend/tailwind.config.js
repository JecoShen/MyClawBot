/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ios': {
          'blue': '#007AFF',
          'green': '#34C759',
          'red': '#FF3B30',
          'orange': '#FF9500',
          'yellow': '#FFCC00',
          'purple': '#AF52DE',
          'pink': '#FF2D55',
          'gray': '#8E8E93',
          'light-gray': '#F2F2F7',
          'dark-gray': '#1C1C1E',
        }
      },
      backdropBlur: {
        'xs': '2px',
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-light': '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
        'ios': '0 2px 10px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [],
}
