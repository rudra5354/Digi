/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0c',
        foreground: '#f8fafc',
        card: {
          DEFAULT: 'rgba(17, 17, 21, 0.75)',
          border: 'rgba(255, 255, 255, 0.08)',
          glow: 'rgba(99, 102, 241, 0.15)'
        },
        primary: {
          DEFAULT: '#6366f1', // Indigo-500
          hover: '#4f46e5', // Indigo-600
        },
        secondary: {
          DEFAULT: '#06b6d4', // Cyan-500
          hover: '#0891b2', // Cyan-600
        },
        accent: {
          purple: '#a855f7',
          pink: '#ec4899',
        },
        muted: '#94a3b8',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
      },
      boxShadow: {
        'glass-sm': '0 2px 8px 0 rgba(0, 0, 0, 0.3)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        'glow-indigo': '0 0 20px 0 rgba(99, 102, 241, 0.35)',
        'glow-cyan': '0 0 20px 0 rgba(6, 118, 212, 0.35)',
      },
      backdropBlur: {
        'glass': '12px',
      }
    },
  },
  plugins: [],
}
