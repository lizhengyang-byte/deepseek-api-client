import { readSSE } from './sse';
import { ApiError } from './deepseek';

/**
 * 网页会话通道（实验性）。
 * 依赖官方网页端当前使用的非公开接口，随时可能调整；
 * 仅用于用户本人的账号，失败时应引导回 API Key 通道。
 */
const WEB_BASE = 'https://chat.deepseek.com';

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: '*/*',
  'x-app-version': '20241129.1',
  'x-client-platform': 'web',
  'x-client-version': '1.0.0',
};

async function post(path: string, token: string, body: unknown, signal?: AbortSignal) {
  const res = await fetch(`${WEB_BASE}${path}`, {
    method: 'POST',
    signal,
    headers: { ...COMMON_HEADERS, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ApiError('网页会话已过期，请重新登录官方网页后再粘贴令牌', res.status);
    }
    throw new ApiError(`网页通道请求失败（HTTP ${res.status}），建议切换 API Key 通道`, res.status);
  }
  return res;
}

export async function createWebSession(token: string, signal?: AbortSignal): Promise<string> {
  const res = await post('/api/v0/chat_session/create', token, {}, signal);
  const json = (await res.json()) as { data?: { biz_data?: { id?: string } } };
  const id = json.data?.biz_data?.id;
  if (!id) throw new ApiError('未能创建网页会话，接口结构可能已变更', 0);
  return id;
}

export interface WebChatRequest {
  token: string;
  sessionId: string;
  parentMessageId: string | null;
  prompt: string;
  thinking: boolean;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  onReasoning?: (text: string) => void;
}

interface Fragment {
  type?: string;
  content?: string;
}

export async function webChat(req: WebChatRequest): Promise<{ finished: boolean }> {
  const res = await post(
    '/api/v0/chat/completion',
    req.token,
    {
      chat_session_id: req.sessionId,
      parent_message_id: req.parentMessageId,
      prompt: req.prompt,
      ref_file_ids: [],
      thinking_enabled: req.thinking,
      search_enabled: false,
    },
    req.signal,
  );

  if (!res.body) throw new ApiError('网页通道响应为空', res.status);

  let finished = false;
  await readSSE(
    res.body,
    (data) => {
      if (data === '[DONE]') return true;
      let json: {
        v?: unknown;
        code?: number;
        msg?: string;
      };
      try {
        json = JSON.parse(data);
      } catch {
        return;
      }
      const event = json.v;
      if (!event || typeof event !== 'object') return;

      // 结束事件
      if ((event as { response?: { status?: string } }).response?.status === 'FINISHED') {
        finished = true;
        return true;
      }

      const fragments = (event as { response?: { fragments?: Fragment[] } }).response?.fragments;
      if (!Array.isArray(fragments)) return;
      for (const fragment of fragments) {
        if (!fragment.content) continue;
        if (fragment.type === 'THINK') req.onReasoning?.(fragment.content);
        else req.onDelta(fragment.content);
      }
    },
    req.signal,
  );

  return { finished };
}
