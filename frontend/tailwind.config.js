/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#111318',
        foreground: '#f5f7fa',
        card: {
          DEFAULT: '#1b1f27',
          border: 'rgba(255, 255, 255, 0.10)',
          glow: 'rgba(255, 92, 0, 0.12)'
        },
        primary: {
          DEFAULT: '#ff5c00',
          hover: '#e65000',
        },
        secondary: {
          DEFAULT: '#272d38',
          hover: '#343c49',
        },
        accent: {
          purple: '#a855f7',
          pink: '#ec4899',
        },
        muted: '#9ca3af',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
      },
      boxShadow: {
        'glass-sm': '0 2px 8px 0 rgba(0, 0, 0, 0.3)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        'glow-indigo': '0 10px 28px 0 rgba(255, 92, 0, 0.18)',
        'glow-cyan': '0 8px 24px 0 rgba(0, 0, 0, 0.26)',
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        'glass': '12px',
      }
    },
  },
  plugins: [],
}
