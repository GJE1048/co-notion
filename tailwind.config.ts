import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate'; // ✅ ES import

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [animate], // 直接使用导入的变量
};

export default config;