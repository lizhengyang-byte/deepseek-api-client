/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        'brand-soft': 'var(--brand-soft)',
        page: 'var(--bg-page)',
        surface: 'var(--bg-surface)',
        card: 'var(--bg-card)',
        ink: 'var(--text-primary)',
        muted: 'var(--text-muted)',
        line: 'var(--border)',
      },
      borderRadius: {
        card: '16px',
        bubble: '12px',
      },
    },
  },
  plugins: [],
};
