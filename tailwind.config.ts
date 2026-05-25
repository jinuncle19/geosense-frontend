import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        earth: {
          50: '#f0f7f4',
          100: '#d9ede6',
          200: '#b3dace',
          300: '#7fc0a8',
          400: '#4da082',
          500: '#2d8463',
          600: '#1d6b4f',
          700: '#175540',
          800: '#144433',
          900: '#11392b',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['DM Sans', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
export default config
