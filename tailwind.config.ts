import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brodie: {
          orange: "#FFB800",
          gold: "#FFB800",
          ink: "#0E0E0E",
          cream: "#FFF7EE",
        },
        glass: {
          bg: "var(--glass-background)",
          surface: "var(--glass-surface)",
          "surface-hover": "var(--glass-surface-hover)",
          "surface-active": "var(--glass-surface-active)",
          border: "var(--glass-border)",
          "border-light": "var(--glass-border-light)",
          text: "var(--glass-text)",
          "text-secondary": "var(--glass-text-secondary)",
          "text-tertiary": "var(--glass-text-tertiary)",
          gold: "var(--glass-gold)",
          red: "var(--glass-red)",
          green: "var(--glass-green)",
          blue: "var(--glass-blue)",
          yellow: "var(--glass-yellow)",
          purple: "var(--glass-purple)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-plex-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
