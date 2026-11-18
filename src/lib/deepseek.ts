import { readSSE } from './sse';
import type { BalanceInfo, ChatMessage, ModelId, Role } from '../types';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ChatRequest {
  baseUrl: string;
  apiKey: string;
  model: ModelId;
  messages: Pick<ChatMessage, 'role' | 'content'>[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  onReasoning?: (text: string) => void;
}

export interface ChatResult {
  promptTokens: number;
  completionTokens: number;
  finished: boolean;
  error?: string;
}

const DEFAULT_BASE = 'https://api.deepseek.com';

export function normalizeBaseUrl(base: string): string {
  const value = (base || DEFAULT_BASE).trim().replace(/\/+$/, '');
  return value || DEFAULT_BASE;
}

async function errorFromResponse(res: Response): Promise<ApiError> {
  let detail = '';
  let code: string | undefined;
  try {
    const json = (await res.json()) as { error?: { message?: string; code?: string } };
    detail = json.error?.message ?? '';
    code = json.error?.code;
  } catch {
    /* 响应体不是 JSON 时忽略 */
  }
  const hints: Record<number, string> = {
    401: 'API Key 无效或已被删除，请到开放平台重新创建',
    402: '账户余额不足，请到开放平台充值后重试',
    429: '请求过于频繁，已被限流，请稍后重试',
    500: '服务端异常，请稍后重试',
    503: '服务暂时不可用，请稍后重试',
  };
  const message = detail || hints[res.status] || `请求失败（HTTP ${res.status}）`;
  return new ApiError(message, res.status, code);
}

export async function fetchBalance(baseUrl: string, apiKey: string): Promise<BalanceInfo | null> {
  const res = await fetch(`${normalizeBaseUrl(baseUrl)}/user/balance`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!res.ok) throw await errorFromResponse(res);
  const json = (await res.json()) as {
    is_available?: boolean;
    balance_infos?: { currency?: string; total_balance?: string }[];
  };
  const first = json.balance_infos?.[0];
  if (!first) return null;
  return {
    isAvailable: Boolean(json.is_available),
    currency: first.currency ?? 'CNY',
    total: first.total_balance ?? '0',
  };
}

export async function validateApiKey(baseUrl: string, apiKey: string): Promise<BalanceInfo | null> {
  return fetchBalance(baseUrl, apiKey);
}

export async function chatCompletion(req: ChatRequest): Promise<ChatResult> {
  const messages = req.messages.map((m) => ({
    role: m.role as Role,
    content: m.content,
  }));

  const res = await fetch(`${normalizeBaseUrl(req.baseUrl)}/chat/completions`, {
    method: 'POST',
    signal: req.signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages,
      stream: true,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      stream_options: { include_usage: true },
    }),
  });

  if (!res.ok) throw await errorFromResponse(res);
  if (!res.body) throw new ApiError('响应流为空', res.status);

  let promptTokens = 0;
  let completionTokens = 0;
  let finished = false;

  await readSSE(
    res.body,
    (data) => {
      if (data === '[DONE]') {
        finished = true;
        return true;
      }
      let json: {
        choices?: { delta?: { content?: string; reasoning_content?: string }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      try {
        json = JSON.parse(data);
      } catch {
        return;
      }
      const delta = json.choices?.[0]?.delta;
      if (delta?.reasoning_content) req.onReasoning?.(delta.reasoning_content);
      if (delta?.content) req.onDelta(delta.content);
      if (json.usage) {
        promptTokens = json.usage.prompt_tokens ?? promptTokens;
        completionTokens = json.usage.completion_tokens ?? completionTokens;
      }
      if (json.choices?.[0]?.finish_reason) finished = true;
    },
    req.signal,
  );

  return { promptTokens, completionTokens, finished };
}

/** 粗略估算 token：中文按字、英文按 4 字符，仅用于缺失 usage 时的兜底 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (/[\u4e00-\u9fff]/.test(ch)) cjk += 1;
    else other += 1;
  }
  return Math.ceil(cjk * 0.7 + other / 4);
}
