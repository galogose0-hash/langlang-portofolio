tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cream:     { DEFAULT: "#FBF9F5", deep: "#F5F0E8" },
        sage:      { DEFAULT: "#D4E2D7", light: "#E2EBE4" },
        ink:       { DEFAULT: "#1E232A", soft: "#3C434D", muted: "#6E6B65" },
        peach:     "#F3E7D8",
        skysoft:   "#DDE6F2",
        sagepastel:"#DCE9DE",
        blush:     "#F4DFE0",
        butter:    "#F4C542"
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        hand: ['"Caveat"', "cursive"]
      },
      borderRadius: { "4xl": "2rem", "5xl": "2.5rem", "6xl": "3rem" },
      boxShadow: {
        soft: "0 18px 40px -22px rgba(30,35,42,0.28)",
        card: "0 28px 60px -30px rgba(30,35,42,0.35)"
      }
    }
  }
};
