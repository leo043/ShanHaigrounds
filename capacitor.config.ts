import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lushi.shanhai',
  appName: '山海战棋',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {},
};

export default config;
