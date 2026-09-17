const config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        driveline: {
          bg: "#060606",
          panel: "#121212",
          raised: "#1c1c1c",
          border: "#2e2e2e",
          text: "#e8e8e8",
          muted: "#9e9e9e",
          accent: "#f5f5f5",
          accentText: "#d4d4d4",
          accentSoft: "#262626"
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
