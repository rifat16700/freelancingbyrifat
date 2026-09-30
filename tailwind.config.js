module.exports = {
  content: [
    "./*.html",
    "./assets/js/**/*.js"
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        "hover-blue": "var(--primary)",
      },
      fontFamily: {
        lato: ['Lato', 'sans-serif'],
        josefin: ['Josefin Sans', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
