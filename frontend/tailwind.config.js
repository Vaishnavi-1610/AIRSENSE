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
        navy: {
          900: '#0b1329',
          800: '#111e38',
          700: '#1b2d52',
          600: '#263d6b',
        },
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
        aqi: {
          good: '#10b981',
          satisfactory: '#84cc16',
          moderate: '#eab308',
          poor: '#f97316',
          verypoor: '#ef4444',
          severe: '#7f1d1d',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
