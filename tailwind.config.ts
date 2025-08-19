import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  plugins: [require("@tailwindcss/forms")],
  theme: {
    extend: {
      fontFamily: {
        rr: ["var(--font-rr)", "sans-serif"],
      },
      backgroundClip: {
        text: "text",
      },
      animation: {
        "run-text": "run-text 1s linear forwards",
      },
      keyframes: {
        "run-text": {
          "0%": {
            transform: "translateX(0%)",
          },
          "100%": {
            transform: "translateX(100%)",
          },
        },
      },
    },
  },
};
export default config;
