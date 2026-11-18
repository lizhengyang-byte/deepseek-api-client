import { create } from 'zustand';
import type { AuthMode, BalanceInfo } from '../types';
import { readSecret, removeSecret, saveSecret } from '../lib/crypto';
import { validateApiKey } from '../lib/deepseek';
import { createWebSession } from '../lib/web';
import { detectCredential, normalizeCredential } from '../lib/credential';

interface AuthStore {
  ready: boolean;
  mode: AuthMode;
  apiKey: string | null;
  webToken: string | null;
  balance: BalanceInfo | null;
  init: () => Promise<void>;
  loginApiKey: (key: string, baseUrl: string) => Promise<{ ok: boolean; message: string }>;
  loginWeb: (token: string) => Promise<{ ok: boolean; message: string }>;
  loginAuto: (input: string, baseUrl: string) => Promise<{ ok: boolean; message: string }>;
  switchMode: (mode: AuthMode) => Promise<void>;
  refreshBalance: (baseUrl: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthStore>((set, get) => ({
  ready: false,
  mode: 'apikey',
  apiKey: null,
  webToken: null,
  balance: null,

  init: async () => {
    const [apiKey, webToken] = await Promise.all([readSecret('apiKey'), readSecret('webToken')]);
    const mode = (await readSecret('mode')) === 'web' && webToken ? 'web' : 'apikey';
    set({ ready: true, apiKey, webToken: webToken ?? null, mode });
  },

  loginApiKey: async (key, baseUrl) => {
    const trimmed = key.trim();
    if (!trimmed) return { ok: false, message: '请输入 API Key' };
    try {
      const balance = await validateApiKey(baseUrl, trimmed);
      await saveSecret('apiKey', trimmed);
      await saveSecret('mode', 'apikey');
      set({ apiKey: trimmed, balance, mode: 'apikey' });
      return { ok: true, message: '登录成功' };
    } catch (error) {
      const message = error instanceof Error ? error.message : '密钥校验失败';
      return { ok: false, message };
    }
  },

  loginWeb: async (token) => {
    const trimmed = normalizeCredential(token);
    if (!trimmed) return { ok: false, message: '请输入网页会话令牌' };
    try {
      // 真正校验一次：能建会话说明令牌还有效，避免把过期令牌写进库里
      await createWebSession(trimmed, AbortSignal.timeout(15000));
    } catch (error) {
      const message = error instanceof Error ? error.message : '令牌校验失败';
      return { ok: false, message: `${message}；可改用 API Key 通道` };
    }
    await saveSecret('webToken', trimmed);
    await saveSecret('mode', 'web');
    set({ webToken: trimmed, mode: 'web', balance: null });
    return { ok: true, message: '已登录网页通道' };
  },

  /**
   * 一次输入、自动分流：粘贴的是 sk- 开头的 API Key 还是网页令牌，
   * 由 @/lib/credential 判断，用户不必先选通道再粘贴。
   */
  loginAuto: async (input, baseUrl) => {
    const trimmed = normalizeCredential(input);
    const kind = detectCredential(trimmed);
    if (kind === 'empty') return { ok: false, message: '请粘贴 API Key 或官方网页令牌' };
    if (kind === 'unknown') {
      return { ok: false, message: '没认出这串凭证：API Key 应以 sk- 开头，网页令牌通常是 eyJ 开头的长串' };
    }
    return kind === 'apikey' ? get().loginApiKey(trimmed, baseUrl) : get().loginWeb(trimmed);
  },

  switchMode: async (mode) => {
    if (mode === 'web' && !get().webToken) return;
    if (mode === 'apikey' && !get().apiKey) return;
    await saveSecret('mode', mode);
    set({ mode });
  },

  refreshBalance: async (baseUrl) => {
    const key = get().apiKey;
    if (!key) return;
    try {
      const balance = await validateApiKey(baseUrl, key);
      set({ balance });
    } catch {
      set({ balance: null });
    }
  },

  logout: async () => {
    await removeSecret('apiKey');
    await removeSecret('webToken');
    await removeSecret('mode');
    set({ apiKey: null, webToken: null, balance: null, mode: 'apikey' });
  },
}));
