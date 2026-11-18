import { Capacitor, registerPlugin } from '@capacitor/core';

interface WebLoginPlugin {
  /**
   * 打开官方登录页（chat.deepseek.com），登录成功后把页面里的 userToken 回传给前端。
   * 只读取令牌，不接触账号密码；用户可以随时关闭返回。
   */
  login(): Promise<{ token?: string; cancelled?: boolean }>;
  available(): Promise<{ supported: boolean }>;
}

const WebLogin = registerPlugin<WebLoginPlugin>('WebLogin');

export function canUseNativeLogin(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('WebLogin');
}

export async function nativeWebLogin(): Promise<{ token?: string; cancelled?: boolean }> {
  if (!canUseNativeLogin()) throw new Error('当前环境不支持 App 内登录，请改用粘贴令牌的方式');
  return WebLogin.login();
}

export const OFFICIAL_LOGIN_URL = 'https://chat.deepseek.com/sign_in';
