import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        happy: {
          // Logo colors — use these for fills, borders and large display type.
          green: '#21B674',
          greenDark: '#009345',
          lime: '#8CC63E',
          /**
           * Accessible text-on-white variant of greenDark. Measured against
           * white 2026-08-18: green 2.62:1 and greenDark 3.99:1 both fail
           * WCAG AA for normal-size text (needs 4.5:1); this hits 4.80:1 while
           * staying in the same hue family. Use it for small green text —
           * greenDark is still fine for large display type (passes the 3:1 bar).
           */
          greenText: '#008440',
        },
      },
    },
  },
  plugins: [],
}

export default config
