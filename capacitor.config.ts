import type { CapacitorConfig } from "@capacitor/core";

const config: CapacitorConfig = {
  appId: "se.fotbollsrummet.app",
  appName: "Fotbollsrummet",
  webDir: "dist",
  server: {
    url: "https://tactic-buddy-app.lovable.app",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      fadeDuration: 200,
    },
    StatusBar: {
      style: "DEFAULT",
      backgroundColor: "#0b3d24",
    },
  },
};

export default config;
