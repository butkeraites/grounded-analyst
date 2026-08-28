import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // Restrained palette — one ink, one paper, one accent. Deliberately
        // not the default Tailwind blue, to avoid the "AI-generated" look.
        ink: "#1a1a1a",
        paper: "#fafaf9",
        accent: "#c2410c",
      },
    },
  },
  plugins: [],
};

export default config;
