const config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        driveline: {
          bg: "#050608",
          panel: "#0f1218",
          raised: "#181c24",
          border: "#2a3140",
          text: "#e8eaed",
          muted: "#9ca3af",
          blue: "#1e3a5f",
          blueLight: "#2a4d7a",
          blueMuted: "#162538"
        }
      },
      borderRadius: {
        driveline: "8px"
      },
      boxShadow: {
        driveline: "0 18px 44px rgba(0, 0, 0, 0.28)",
        drivelineHover: "0 22px 54px rgba(0, 0, 0, 0.36)"
      }
    }
  },
  plugins: []
};

export default config;
