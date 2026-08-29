import type { Config } from "tailwindcss";

// BIS — Butkeraites Intelligent Solutions. Dark, tech-forward: deep navy
// surfaces, a coral brand, blue/teal accents. Tokens map to the existing
// class names so the whole app adopts the brand.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // Backgrounds & surfaces
        bg: "#0a0f1c",
        "bg-2": "#0c1322",
        surface: "rgb(17 26 44 / <alpha-value>)", // #111a2c
        "surface-2": "#16203a",
        line: "rgb(33 48 75 / <alpha-value>)", // #21304b
        // Remapped semantic names (dark theme): ink = light text, paper = dark bg
        ink: "rgb(238 242 251 / <alpha-value>)", // #eef2fb
        paper: "#0a0f1c",
        accent: "rgb(255 71 87 / <alpha-value>)", // brand coral #ff4757
        // Brand palette
        brand: "rgb(255 71 87 / <alpha-value>)",
        "brand-2": "#ff8a4c",
        "accent-blue": "#5b9bff",
        "accent-teal": "#34e0c0",
        good: "#2fd39a",
        muted: "#808faa",
      },
    },
  },
  plugins: [],
};

export default config;
