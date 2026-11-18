import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lizhengyang.deepseekapi',
  appName: 'DeepSeek API 版',
  webDir: 'dist',
  android: {
    // WebView 内直接 fetch 官方接口，避免被 MixedContent 拦截
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
