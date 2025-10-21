import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./tests/**/*.{ts,tsx}", "./node_modules/react-chartjs-2/dist/**/*.js"],
  theme: {
    extend: {
      colors: {
        brand: {
          light: "#c084fc",
          DEFAULT: "#7c3aed",
          dark: "#5b21b6",
          deeper: "#2e1065"
        }
      }
    }
  },
  plugins: []
};

export default config;
