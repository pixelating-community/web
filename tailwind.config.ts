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
      fontSize: {
        fluid: "clamp(0.25rem, 3.5vw, 15rem)",
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
