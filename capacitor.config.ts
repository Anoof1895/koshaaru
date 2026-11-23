import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dhivehilanguagehub.app',
  appName: 'Koshaaru',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#0D6E6E',
    },
    CapacitorUpdater: {
      autoUpdate: false,
    },
  },
};

export default config;
