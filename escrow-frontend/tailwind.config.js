/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Black-Green theme
        'bg-dark': '#0a0a0a',
        'bg-card': '#1a1a1a', 
        'bg-hover': '#2a2a2a',
        'text-primary': '#ffffff',
        'text-secondary': '#b0b0b0',
        'text-muted': '#808080',
        'accent-green': '#00ff88',
        'accent-green-dark': '#00cc66',
        'accent-green-light': '#33ffaa',
        'border-dark': '#333333',
        'border-green': '#00ff88',
        'success': '#00ff88',
        'warning': '#ffaa00',
        'error': '#ff4444',
      },
      backgroundImage: {
        'gradient-green': 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
      },
      animation: {
        'pulse-green': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #00ff88' },
          '100%': { boxShadow: '0 0 20px #00ff88, 0 0 30px #00ff88' },
        }
      }
    },
  },
  plugins: [],
}