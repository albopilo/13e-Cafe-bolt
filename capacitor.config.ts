import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cafe13e.staff',
  appName: '13e Café',
  webDir: 'dist',
  android: {
    backgroundColor: '#3E2723',
    allowMixedContent: false,
  captureInput: true,
    webContentsDebuggingEnabled: false,
  overrideUserInterfaceStyle: 'dark',
  backgroundColorTop: '#4a2c2a',
    backgroundColorBottom: '#3E2723',
  navigationHandler: {
      enabled: true,
      domains: ['13e-menu.netlify.app'],
      customSchemes: ['whatsapp', 'tel'],
    },
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
