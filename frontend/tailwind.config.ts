import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "'Helvetica Neue'",
          "sans-serif",
        ],
      },
      colors: {
        bg: "#0a0a0b",
        panel: "#111113",
        soft: "#1a1a1d",
        line: "#26262b",
        muted: "#8a8a94",
        ink: "#f5f5f7",
        accent: "#7c5cff",
        accent2: "#22d3ee",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,92,255,0.35), 0 8px 32px -8px rgba(124,92,255,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
