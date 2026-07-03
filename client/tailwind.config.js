export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        farm: {
          50: "#f3faf2",
          100: "#def3dc",
          500: "#2f8f46",
          700: "#206533",
          950: "#112617"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 18px 45px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};
