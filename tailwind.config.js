/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./generate_site.py",
    "./pages/**/*.html",
    "./*.html",
    "./posts/**/*.html",
    "./tools/**/*.html",
    "./stamp-of-trust/**/*.html",
    "./sections/**/*.html",
    "./assets/js/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "#0a0a0a",
        charcoal: "#1a1a1a",
        "dark-gray": "#2a2a2a",
        primary: "#166534",
        secondary: "#4ade80",
      },
      boxShadow: {
        "glow-sleek": "0 0 15px -5px rgba(22, 101, 52, 0.3)",
      },
    },
  },
  plugins: [],
};
