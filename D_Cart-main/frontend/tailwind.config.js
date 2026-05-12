/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "sans-serif"]
      },
      colors: {
        brand: {
          50: "#f2fbf8",
          100: "#d1f3e8",
          200: "#a6e4d0",
          300: "#74d0b3",
          400: "#44b592",
          500: "#2a9978",
          600: "#1e7d62",
          700: "#1b654f",
          800: "#1a5040",
          900: "#184336"
        },
        ink: "#16302a",
        accent: "#f59e0b"
      },
      boxShadow: {
        panel: "0 12px 32px rgba(12, 38, 31, 0.08)"
      },
      backgroundImage: {
        "mesh-soft":
          "radial-gradient(circle at top left, rgba(68, 181, 146, 0.20), transparent 32%), radial-gradient(circle at bottom right, rgba(245, 158, 11, 0.18), transparent 26%)"
      }
    }
  },
  plugins: []
};
