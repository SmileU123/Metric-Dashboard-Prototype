/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // White-label tokens — overridden per tenant at runtime via CSS variables.
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          fg: "rgb(var(--brand-fg) / <alpha-value>)",
        },
        surface: "rgb(var(--surface) / <alpha-value>)",
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        // Traffic-light compliance states.
        green: "rgb(var(--state-green) / <alpha-value>)",
        amber: "rgb(var(--state-amber) / <alpha-value>)",
        red: "rgb(var(--state-red) / <alpha-value>)",
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
