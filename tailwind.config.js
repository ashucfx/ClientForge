/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          obsidian:  '#0A0B0D',
          bone:      '#F4F1EB',
          graphite:  '#1F2226',
          parchment: '#E6DFD1',
          gold:      '#B8935B',
          ink:       '#0E1A3A',
        },
        // Semantic brand colors — used across sections
        growth:  { DEFAULT: '#10B981', light: 'rgba(16,185,129,0.14)', dark: '#059669' },
        ripple:  { DEFAULT: '#A78BFA', light: 'rgba(167,139,250,0.14)', dark: '#7C3AED' },
        // Status semantic tokens
        status: {
          open:       '#3b82f6',
          active:     '#10B981',
          warning:    '#f59e0b',
          danger:     '#ef4444',
          completed:  '#6b7280',
          archived:   '#94a3b8',
        },
      },
      fontFamily: {
        sans: ['Söhne', 'system-ui', 'sans-serif'],
        serif: ['GT Sectra', 'Canela', 'Georgia', 'serif'],
        mono: ['Söhne Mono', 'Courier New', 'monospace'],
      },
      fontSize: {
        'status': ['11px', { lineHeight: '14px', letterSpacing: '0.04em' }],
        'metadata': ['12px', { lineHeight: '16px', letterSpacing: '0.02em' }],
        'body': ['14px', { lineHeight: '22px', letterSpacing: '0.01em' }],
        'subheading': ['16px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        'heading': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
        'display': ['32px', { lineHeight: '40px', letterSpacing: '-0.03em' }],
        'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.04em' }],
      },
      fontWeight: {
        400: '400',
        500: '500',
        600: '600',
        700: '700',
        800: '800',
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '14px',
        'xl': '18px',
        '2xl': '24px',
        '3xl': '32px',
        'full': '9999px',
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(15, 23, 42, 0.04)',
        'sm': '0 2px 8px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
        'md': '0 8px 24px rgba(15, 23, 42, 0.06), 0 2px 6px rgba(15, 23, 42, 0.04)',
        'lg': '0 14px 40px rgba(15, 23, 42, 0.08), 0 4px 10px rgba(15, 23, 42, 0.05)',
        'xl': '0 24px 56px rgba(15, 23, 42, 0.12), 0 8px 20px rgba(15, 23, 42, 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.5s infinite linear',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      },
    },
  },
  plugins: [],
};
