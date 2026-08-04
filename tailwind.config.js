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
          primary: '#0a0a0a',
          secondary: '#141414',
          tertiary: '#1f1f1f',
        },
        text: {
          primary: '#f5f5f5',
          secondary: '#94a3b8',
          // 앱 전반에서 text-text-tertiary를 쓰고 있었지만 토큰이 없어
          // 전부 상속색(사실상 primary)으로 렌더돼 위계가 무너져 있었다.
          tertiary: '#64748b',
        },
        accent: {
          DEFAULT: '#8b5cf6',
          hover: '#7c3aed',
          light: '#a78bfa',
        },
        tag: {
          bg: '#1e293b',
          text: '#cbd5e1',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tight: '-0.02em',
      },
    },
  },
  plugins: [],
}
