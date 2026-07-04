export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        farm: {
          50: "#f2f6f0",
          100: "#e6f0e8",
          200: "#d5eddb",
          300: "#bde0c8",
          500: "#4aab76",
          700: "#276749",
          800: "#21543d",
          900: "#1c3f31",
          950: "#18271e"
        },
        field: {
          cream: "#f8fbf6",
          mist: "#f2f6f0",
          sage: "#e6f0e8",
          lime: "#d5eddb",
          soil: "#5e7d68",
          danger: "#c0392b"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 10px 26px rgba(39, 103, 73, 0.11)",
        lift: "0 22px 60px rgba(24, 39, 30, 0.14)"
      }
    }
  },
  plugins: []
};
