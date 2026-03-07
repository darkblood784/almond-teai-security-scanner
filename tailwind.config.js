/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 杏仁茶主色系 — warm almond / amber
        brand: {
          50:  '#FFF8E7',  // 奶白
          100: '#F5E6C8',  // 杏仁奶
          200: '#E8D5A3',  // 淺杏仁
          300: '#D4B87A',  // 杏仁金
          400: '#C4993F',  // 琥珀
          500: '#B8832A',  // 深琥珀（主色）
          600: '#9A6D22',  // 深棕金
          700: '#7A531A',  // 焦糖
          800: '#5C3D12',  // 深焦糖
          900: '#3D280A',  // 極深棕
        },
        // 背景暖棕色系
        warm: {
          950: '#0F0A04',
          900: '#1A1208',
          800: '#251A0C',
          700: '#332410',
          600: '#4A3418',
          500: '#6B4E24',
          400: '#8A6735',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'steam':      'steam 2s ease-in-out infinite',
        'float':      'float 3s ease-in-out infinite',
      },
      keyframes: {
        steam: {
          '0%, 100%': { opacity: '0.3', transform: 'translateY(0) scaleX(1)' },
          '50%':      { opacity: '0.8', transform: 'translateY(-6px) scaleX(1.1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
};
