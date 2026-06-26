/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07080c',
          900: '#0c0e15',
          850: '#11141d',
          800: '#161a26',
          700: '#1f2433',
          600: '#2b3142',
          500: '#3a4255',
        },
        accent: {
          DEFAULT: '#5b8cff',
          soft: '#8fb0ff',
          dim: '#2d4a8a',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Hiragino Sans',
          'Hiragino Kaku Gothic ProN',
          'Noto Sans JP',
          'Meiryo',
          'sans-serif',
        ],
      },
      boxShadow: {
        panel: '0 10px 40px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
