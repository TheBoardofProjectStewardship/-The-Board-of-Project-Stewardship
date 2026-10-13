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
        paper: "#f6f1e6",
        "paper-2": "#efe8d8",
        ink: "#1a1712",
        muted: "#4f483d",
        line: "#cfc5b2",
        accent: "#14532d",
        obsidian: "#f6f1e6",
        charcoal: "#efe8d8",
        "dark-gray": "#e7e0d0",
        primary: "#14532d",
        secondary: "#14532d",
      },
      borderRadius: {
        DEFAULT: "4px",
        md: "4px",
        lg: "4px",
        xl: "10px",
        "2xl": "10px",
      },
      boxShadow: {
        "glow-sleek": "none",
      },
    },
  },
  plugins: [],
};
