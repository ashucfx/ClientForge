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
          blue: '#1f56d4',
          'blue-dark': '#1a42a0',
          'blue-light': '#e8f0fe',
          green: '#3FBD8B',
          'green-dark': '#2d9970',
          'green-light': '#e6f9f1',
          navy: '#0f1c3d',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'Courier New', 'monospace'],
      },
      fontWeight: {
        600: '600',
        700: '700',
        800: '800',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(31, 86, 212, 0.08)',
        'card-hover': '0 8px 32px rgba(31, 86, 212, 0.14)',
        invoice: '0 4px 40px rgba(31, 86, 212, 0.10)',
      },
      animation: {
        'fade-up': 'fadeSlideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
