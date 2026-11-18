import { create } from 'zustand';
import type { BalanceInfo, ModelId, Settings } from '../types';
import { DEFAULT_PRICING } from '../lib/usage';
import { readSetting, saveSetting } from '../lib/db';
import { fetchBalance } from '../lib/deepseek';

const DEFAULTS: Settings = {
  theme: 'light',
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: '',
  contextRounds: 20,
  baseUrl: 'https://api.deepseek.com',
  pricing: DEFAULT_PRICING,
  fontSize: 'md',
  searchEnabled: false,
  searchProvider: 'searxng',
  searchEndpoint: '',
  searchKey: '',
};

interface SettingsStore extends Settings {
  ready: boolean;
  balance: BalanceInfo | null;
  hydrate: () => Promise<void>;
  patch: (values: Partial<Settings>) => void;
  refreshBalance: (apiKey: string) => Promise<void>;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  ready: false,
  balance: null,

  hydrate: async () => {
    const stored = await readSetting<Partial<Settings>>('settings');
    const merged: Settings = { ...DEFAULTS, ...(stored ?? {}) };
    merged.pricing = { ...DEFAULT_PRICING, ...(stored?.pricing ?? {}) };
    set({ ...merged, ready: true });
  },

  patch: (values) => {
    const next = { ...get(), ...values };
    const snapshot: Settings = {
      theme: next.theme,
      model: next.model,
      temperature: next.temperature,
      maxTokens: next.maxTokens,
      systemPrompt: next.systemPrompt,
      contextRounds: next.contextRounds,
      baseUrl: next.baseUrl,
      pricing: next.pricing,
      fontSize: next.fontSize,
      searchEnabled: next.searchEnabled,
      searchProvider: next.searchProvider,
      searchEndpoint: next.searchEndpoint,
      searchKey: next.searchKey,
    };
    set(values);
    void saveSetting('settings', snapshot);
  },

  refreshBalance: async (apiKey) => {
    if (!apiKey) return;
    try {
      const balance = await fetchBalance(get().baseUrl, apiKey);
      set({ balance });
    } catch {
      set({ balance: null });
    }
  },
}));

export function resolveModel(): ModelId {
  return useSettings.getState().model;
}
