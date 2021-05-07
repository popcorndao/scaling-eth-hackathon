module.exports = {
  purge: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      scale: { 101: "1.01" },
    },
  },
  variants: {
    extend: { opacity: ["disabled"] },
  },
  plugins: [],
};
