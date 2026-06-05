import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // Dopamine Dark palette (driven by CSS vars in index.css)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          raised: 'hsl(var(--surface-raised))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        // Semantic casino colors
        gold: '#f5b942',
        win: '#1fd655',
        loss: '#ff4d5e',
        // Rank colors
        bronze: '#cd7f32',
        silver: '#c0c7d4',
        diamond: '#7be3ff',
        // Roulette
        'roulette-red': '#d4143a',
        'roulette-black': '#1a1d27',
        'roulette-green': '#1fa055',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Clash Display"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(245, 185, 66, 0.45)',
        'glow-win': '0 0 28px -4px rgba(31, 214, 85, 0.55)',
        'glow-loss': '0 0 28px -4px rgba(255, 77, 94, 0.55)',
        card: '0 8px 30px -10px rgba(0, 0, 0, 0.6)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #f5b942 0%, #f7d27a 50%, #d99a1f 100%)',
        'felt': 'radial-gradient(ellipse at center, #15603a 0%, #0c3d24 70%, #082a19 100%)',
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        'flash-win': {
          '0%': { backgroundColor: 'rgba(31,214,85,0)' },
          '30%': { backgroundColor: 'rgba(31,214,85,0.25)' },
          '100%': { backgroundColor: 'rgba(31,214,85,0)' },
        },
        'flash-loss': {
          '0%': { backgroundColor: 'rgba(255,77,94,0)' },
          '30%': { backgroundColor: 'rgba(255,77,94,0.2)' },
          '100%': { backgroundColor: 'rgba(255,77,94,0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 16px -6px rgba(245,185,66,0.4)' },
          '50%': { boxShadow: '0 0 28px -2px rgba(245,185,66,0.8)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        shake: 'shake 0.5s ease-in-out',
        'flash-win': 'flash-win 0.9s ease-out',
        'flash-loss': 'flash-loss 0.9s ease-out',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
