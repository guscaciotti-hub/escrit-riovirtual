/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identidade Evoluze
        evoluze: {
          teal: '#00D4C6',
          dark: '#0B1220',
          panel: '#111a2b',
          border: '#1e2b45',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
