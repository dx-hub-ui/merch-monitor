import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./tests/**/*.{ts,tsx}", "./node_modules/react-chartjs-2/dist/**/*.js"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563eb",
          dark: "#1e40af"
        }
      }
    }
  },
  plugins: []
};

export default config;
