/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        blue: {
          50: "#f1f6fa",
          100: "#dce9f2",
          200: "#bdd4e5",
          300: "#90b7d1",
          400: "#5d94b9",
          500: "#326f9b",
          600: "#13416b",
          700: "#103858",
          800: "#102f49",
          900: "#10283d",
          950: "#091827",
        },

        /* Semantic theme tokens — resolved from CSS variables per active theme. */
        surface: "var(--surface)",
        "surface-strong": "var(--surface-strong)",
        panel: "var(--panel)",
        "panel-strong": "var(--panel-strong)",
        "panel-soft": "var(--panel-soft)",
        inset: "var(--inset)",
        "inset-soft": "var(--inset-soft)",
        "inset-strong": "var(--inset-strong)",
        raised: "var(--raised)",
        "raised-soft": "var(--raised-soft)",
        "raised-strong": "var(--raised-strong)",
        overlay: "var(--overlay)",
        hover: "var(--hover)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        shade: "var(--shade)",

        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        "ink-4": "var(--ink-4)",

        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "accent-line": "var(--accent-line)",
        "accent-ring": "var(--accent-ring)",
        "accent-solid": "var(--accent-solid)",
        "accent-hover": "var(--accent-hover)",
        onaccent: "var(--on-accent)",

        ok: "var(--ok)",
        "ok-soft": "var(--ok-soft)",
        "ok-line": "var(--ok-line)",
        "ok-solid": "var(--ok-solid)",
        "ok-hover": "var(--ok-hover)",

        warn: "var(--warn)",
        "warn-soft": "var(--warn-soft)",
        "warn-line": "var(--warn-line)",
        "warn-solid": "var(--warn-solid)",
        "warn-hover": "var(--warn-hover)",

        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
        "danger-line": "var(--danger-line)",
        "danger-solid": "var(--danger-solid)",
        "danger-hover": "var(--danger-hover)",

        info: "var(--info)",
        "info-soft": "var(--info-soft)",
        "info-line": "var(--info-line)",

        alt: "var(--alt)",
        "alt-soft": "var(--alt-soft)",
        "alt-line": "var(--alt-line)",
        "alt-solid": "var(--alt-solid)",
        "alt-hover": "var(--alt-hover)",

        /* Login shader canvas: dark in both themes, brand blue in light. */
        "login-canvas": "var(--login-canvas)",
        "login-canvas-hairline": "var(--login-canvas-hairline)",
      },
      boxShadow: {
        "accent-glow": "0 10px 30px -10px var(--accent-glow)",
      },
    },
  },
  plugins: [],
};
