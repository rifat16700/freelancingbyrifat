module.exports = {
  content: [
    "./**/*.html",
    "./assets/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        secondary: "var(--text-dark)",
        "top-bar": "var(--primary-dark)",
        "bg-light": "var(--bg-light)",
        "hover-blue": "#2F1AC4"
      },
      fontFamily: {
        josefin: ["Josefin Sans", "sans-serif"],
        lato: ["Lato", "sans-serif"]
      }
    }
  },
  plugins: [],
}
