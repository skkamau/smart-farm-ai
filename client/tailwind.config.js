export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        farm: {
          50: "#f7f8f2",
          100: "#ebedd9",
          200: "#dfe3c4",
          300: "#cbd3a5",
          500: "#3b7a58",
          700: "#06452f",
          800: "#013d2a",
          900: "#003522",
          950: "#08251a"
        },
        field: {
          cream: "#f8f9f4",
          mist: "#eef1e8",
          sage: "#e4e8cf",
          lime: "#dfe8bf",
          soil: "#867b62",
          danger: "#b74444"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 12px 30px rgba(8, 37, 26, 0.08)",
        lift: "0 18px 50px rgba(8, 37, 26, 0.12)"
      }
    }
  },
  plugins: []
};
