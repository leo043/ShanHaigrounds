import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lushi.shanhai',
  appName: '山海战棋',
  webDir: 'dist',
  server: {
    // 开发阶段用内置服务器，打包后用 file://
    androidScheme: 'https'
  },
  plugins: {},
};

export default config;
