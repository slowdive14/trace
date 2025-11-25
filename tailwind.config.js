/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0d0d0d',
          secondary: '#1a1a1a',
          tertiary: '#262626',
        },
        text: {
          primary: '#ffffff',
          secondary: '#a0a0a0',
        },
        accent: '#6366f1',
        tag: {
          bg: '#374151',
          text: '#93c5fd',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
