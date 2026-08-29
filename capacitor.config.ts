import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Provisional bundle id for the TestFlight shell. We can lock the final id
  // when the Apple Developer account / App Store Connect record is created.
  appId: 'app.openstars.mobile',
  appName: 'OPEN STARS',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 700,
      showSpinner: false,
    },
  },
};

export default config;
