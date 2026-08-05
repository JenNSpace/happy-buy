import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        happy: {
          green: '#21B674',
          greenDark: '#009345',
          lime: '#8CC63E',
        },
      },
    },
  },
  plugins: [],
}

export default config
