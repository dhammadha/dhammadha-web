import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#2B1B3D",
        mint: "#5ECEC8",
        "mint-light": "#e8faf9",
        "mint-mid": "#b8ecea",
        bg: "#f5f5f2",
        border: "#e8e8e0",
      },
      fontFamily: {
        thai: ["var(--font-noto-thai)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        site: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
