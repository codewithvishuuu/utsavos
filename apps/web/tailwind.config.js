/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12100E",
        "ink-soft": "#1C1814",
        ivory: "#FAF6F0",
        cream: "#F2ECE2",
        terracotta: "#C85A32",
        "terracotta-deep": "#A84422",
        "terracotta-dark": "#8F3A1D",
        "terracotta-light": "#E08A6A",
        sage: "#5F6F5E",
        "sage-dark": "#3F4A3E",
        "sage-light": "#9AAE96",
        gold: "#B08D57",
        line: "#DED5C8"
      },
      fontFamily: {
        display: ['"Iowan Old Style"', '"Palatino Linotype"', '"Book Antiqua"', "Georgia", "serif"],
        sans: ['"Avenir Next"', "Avenir", '"Segoe UI"', "Helvetica", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};
