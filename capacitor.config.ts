import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lizhengyang.deepseekapi',
  appName: 'DeepSeek API 版',
  webDir: 'dist',
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
