/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07120f",
        panel: "#10201b",
        line: "#294039",
        lime: "#b8f34a",
        mint: "#72e6b1",
        fog: "#9fb2ab"
      },
      boxShadow: {
        glow: "0 0 60px rgba(184, 243, 74, 0.12)"
      }
    }
  },
  plugins: []
};
