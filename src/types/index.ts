export type Role = 'system' | 'user' | 'assistant';

export type ModelId = 'deepseek-chat' | 'deepseek-reasoner';

export type MessageStatus = 'streaming' | 'done' | 'error' | 'interrupted';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  reasoning?: string;
  status: MessageStatus;
  createdAt: number;
  promptTokens?: number;
  completionTokens?: number;
  model?: ModelId;
}

export type ConversationSource = 'native' | 'imported';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: ModelId;
  pinned: boolean;
  archived: boolean;
  source: ConversationSource;
  messageCount: number;
}

export interface UsageRecord {
  id?: number;
  conversationId: string;
  model: ModelId;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  at: number;
}

export type AuthMode = 'apikey' | 'web';

export interface AuthState {
  mode: AuthMode;
  hasApiKey: boolean;
  hasWebToken: boolean;
  apiKeyValid: boolean;
  webTokenValid: boolean;
  balance?: BalanceInfo | null;
}

export interface BalanceInfo {
  isAvailable: boolean;
  currency: string;
  total: string;
}

export interface Pricing {
  currency: 'CNY';
  inputPerMillion: number;
  outputPerMillion: number;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  model: ModelId;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  contextRounds: number;
  baseUrl: string;
  pricing: Record<ModelId, Pricing>;
  fontSize: 'sm' | 'md' | 'lg';
  /** 最小 Agent：开启后由模型自己判断是否需要联网检索一次 */
  searchEnabled: boolean;
  searchProvider: 'searxng' | 'tavily' | 'custom';
  searchEndpoint: string;
  searchKey: string;
}

export interface ImporterMessage {
  role: Role;
  content: string;
  reasoning?: string;
  createdAt?: number;
}

export interface ImporterConversation {
  id: string;
  title: string;
  createdAt?: number;
  updatedAt?: number;
  messages: ImporterMessage[];
}

export interface ImportPreview {
  conversations: number;
  messages: number;
  skipped: number;
  items: ImporterConversation[];
  warnings: string[];
}
