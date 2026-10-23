import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Lucida Grande"', '"Lucida Sans Unicode"', '"Helvetica Neue"', 'Helvetica', 'Arial', '"Liberation Sans"', '"DejaVu Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
