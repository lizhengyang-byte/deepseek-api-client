import type { Settings } from '../types';
import { normalizeBaseUrl } from './deepseek';

/**
 * 最小 Agent：只做一件事——判断当前问题是否需要联网，需要就搜一次，然后把结果交给主模型作答。
 * 没有多步规划、没有工具循环，最多一次搜索，保持轻量。
 */

export interface SearchSource {
  title: string;
  url: string;
}

export class SearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchError';
  }
}

const TOOL = {
  type: 'function',
  function: {
    name: 'search_web',
    description:
      '一次性网络搜索，用于获取最新信息、具体资料或核实事实。只有当问题确实依赖外部实时信息时才调用；常识、推理、写作等不需要。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索关键词，尽量简短，保留专有名词与时间限定' },
      },
      required: ['query'],
    },
  },
} as const;

/** 让模型自己判断要不要搜；失败一律退化为普通对话，不打断用户 */
export async function decideSearch(options: {
  baseUrl: string;
  apiKey: string;
  question: string;
  signal?: AbortSignal;
}): Promise<string | null> {
  // 调度这一小步固定用 deepseek-chat：支持工具调用、便宜、快；
  // 正式作答仍沿用用户当前选择的模型。
  const res = await fetch(`${normalizeBaseUrl(options.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            '你是检索调度器。判断用户问题是否必须依赖外部实时信息；是则调用 search_web 并给出简短检索词，否则不要调用任何工具。',
        },
        { role: 'user', content: options.question },
      ],
      tools: [TOOL],
      tool_choice: 'auto',
      temperature: 0,
      max_tokens: 128,
      stream: false,
    }),
    signal: options.signal,
  });

  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
  } | null;
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call || call.function?.name !== 'search_web') return null;
  try {
    const args = JSON.parse(call.function.arguments ?? '{}') as { query?: string };
    return (args.query ?? '').trim() || null;
  } catch {
    return null;
  }
}

interface RawResult {
  title?: string;
  url?: string;
  link?: string;
  content?: string;
  snippet?: string;
  body?: string;
}

function pickResults(payload: unknown): RawResult[] {
  const data = payload as { results?: RawResult[]; items?: RawResult[]; web?: { results?: RawResult[] } };
  return data?.results ?? data?.items ?? data?.web?.results ?? [];
}

async function fetchSearch(settings: Settings, query: string, signal?: AbortSignal): Promise<RawResult[]> {
  const endpoint = settings.searchEndpoint.trim();

  if (settings.searchProvider === 'tavily') {
    if (!settings.searchKey.trim()) throw new SearchError('Tavily 需要填写 API Key');
    const res = await fetch(endpoint || 'https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: settings.searchKey.trim(),
        query,
        search_depth: 'basic',
        max_results: 5,
      }),
      signal,
    });
    if (!res.ok) throw new SearchError(`搜索接口返回 ${res.status}`);
    return pickResults(await res.json());
  }

  if (!endpoint) throw new SearchError('还没有配置搜索接口');
  const sep = endpoint.includes('?') ? '&' : '?';
  const url =
    settings.searchProvider === 'searxng'
      ? `${endpoint.replace(/\/$/, '')}/search${sep}q=${encodeURIComponent(query)}&format=json`
      : `${endpoint}${sep}q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new SearchError(`搜索接口返回 ${res.status}`);
  return pickResults(await res.json());
}

/** 执行一次搜索，返回给模型看的资料块 + 给用户看的来源列表 */
export async function runSearch(
  query: string,
  settings: Settings,
  signal?: AbortSignal,
): Promise<{ block: string; sources: SearchSource[] }> {
  const raw = await fetchSearch(settings, query, signal);
  const sources: SearchSource[] = [];
  const lines: string[] = [];

  for (const item of raw) {
    const url = item.url ?? item.link ?? '';
    const title = (item.title ?? url).trim();
    const snippet = (item.content ?? item.snippet ?? item.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 260);
    if (!url || !/^https?:/i.test(url)) continue;
    sources.push({ title, url });
    lines.push(`[${sources.length}] ${title}\n${url}\n${snippet}`);
    if (sources.length >= 5) break;
  }

  if (!sources.length) throw new SearchError('搜索没有返回可用结果，已直接作答');

  const block =
    '以下是一次网络检索的结果，请据此回答，并在引用处标注编号（例如 [1]）。若结果与问题无关，可忽视并直接作答。\n\n' +
    lines.join('\n\n');

  return { block, sources };
}
