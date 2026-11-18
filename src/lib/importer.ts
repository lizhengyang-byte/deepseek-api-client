import JSZip from 'jszip';
import type {
  ImporterConversation,
  ImporterMessage,
  ImportPreview,
  Role,
} from '../types';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(obj: AnyRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

/** 内容字段可能是字符串、对象或片段数组，统一抽取为纯文本 */
export function extractText(input: unknown): string {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    return input
      .map((part) => extractText(part))
      .filter(Boolean)
      .join('\n');
  }
  if (isRecord(input)) {
    for (const key of ['text', 'content', 'value', 'parts', 'message']) {
      if (key in input) {
        const text = extractText(input[key]);
        if (text) return text;
      }
    }
  }
  return '';
}

export function normalizeRole(input: unknown): Role | null {
  if (typeof input !== 'string') return null;
  const value = input.toLowerCase();
  if (value === 'user' || value === 'human') return 'user';
  if (value === 'assistant' || value === 'ai' || value === 'bot') return 'assistant';
  if (value === 'system') return 'system';
  return null;
}

function toTimestamp(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) {
    // 秒级时间戳补成毫秒
    return input < 1e12 ? input * 1000 : input;
  }
  if (typeof input === 'string' && input.trim()) {
    const numeric = Number(input);
    if (!Number.isNaN(numeric) && input.trim().length <= 13) {
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(input);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function looksLikeConversation(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const hasMessages =
    'messages' in value || 'chat_messages' in value || 'mapping' in value || 'message_list' in value;
  const hasMeta = 'title' in value || 'id' in value || 'chat_session_id' in value || 'created_at' in value;
  return hasMessages && hasMeta;
}

function collectConversationArrays(root: unknown): AnyRecord[][] {
  const found: AnyRecord[][] = [];
  const visited = new WeakSet<object>();

  const walk = (node: unknown, depth: number) => {
    if (depth > 8 || node === null || typeof node !== 'object') return;
    if (visited.has(node as object)) return;
    visited.add(node as object);

    if (Array.isArray(node)) {
      const records = node.filter(isRecord);
      if (records.length && records.filter(looksLikeConversation).length >= Math.max(1, records.length * 0.6)) {
        found.push(records);
      }
      node.forEach((item) => walk(item, depth + 1));
      return;
    }
    Object.values(node as AnyRecord).forEach((value) => walk(value, depth + 1));
  };

  walk(root, 0);
  return found;
}

function messageFromRecord(raw: unknown): ImporterMessage | null {
  if (typeof raw === 'string') {
    return { role: 'assistant', content: raw };
  }
  if (!isRecord(raw)) return null;
  const role = normalizeRole(raw.role ?? raw.sender ?? raw.author ?? raw.from);
  if (!role) return null;
  const content = extractText(raw.content ?? raw.text ?? raw.message ?? raw.parts);
  if (!content.trim()) return null;
  const createdAt = toTimestamp(raw.created_at ?? raw.createdAt ?? raw.inserted_at ?? raw.timestamp ?? raw.time);
  const reasoning = extractText(raw.reasoning_content ?? raw.reasoning ?? raw.thinking);
  return { role, content, createdAt, reasoning: reasoning || undefined };
}

/** mapping 树：从叶子回溯到根，还原一条线性对话 */
function messagesFromMapping(mapping: Record<string, unknown>): ImporterMessage[] {
  const nodes = new Map<
    string,
    { id: string; parentId: string | null; message: unknown; children: string[]; index: number }
  >();

  Object.entries(mapping).forEach(([key, value], index) => {
    if (!isRecord(value)) return;
    const id = typeof value.id === 'string' ? value.id : key;
    const parentId = typeof value.parent === 'string' ? value.parent : null;
    nodes.set(id, {
      id,
      parentId,
      message: value.message,
      children: [],
      index,
    });
  });

  nodes.forEach((node) => {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node.id);
    }
  });

  const leaves = [...nodes.values()].filter((node) => node.children.length === 0);
  // 取插入顺序最靠后的叶子，通常也是最新分支
  const leaf = leaves.sort((a, b) => b.index - a.index)[0];
  if (!leaf) return [];

  const chain: ImporterMessage[] = [];
  let cursor: string | null = leaf.id;
  const guard = new Set<string>();
  while (cursor && nodes.has(cursor) && !guard.has(cursor)) {
    guard.add(cursor);
    const node = nodes.get(cursor);
    if (!node) break;
    const message = messageFromRecord(node.message);
    if (message) chain.push(message);
    cursor = node.parentId;
  }
  return chain.reverse();
}

function messagesFromArray(list: unknown): ImporterMessage[] {
  if (!Array.isArray(list)) return [];
  return list
    .map(messageFromRecord)
    .filter((item): item is ImporterMessage => item !== null);
}

export function normalizeConversation(raw: AnyRecord): ImporterConversation | null {
  const title = pickString(raw, ['title', 'name', 'subject']) ?? '未命名会话';
  const rawId = pickString(raw, ['id', 'chat_session_id', 'conversation_id', 'session_id', 'uuid']);

  let messages: ImporterMessage[] = [];
  if (raw.mapping && isRecord(raw.mapping)) {
    messages = messagesFromMapping(raw.mapping);
  } else if (Array.isArray(raw.messages)) {
    messages = messagesFromArray(raw.messages);
  } else if (Array.isArray(raw.chat_messages)) {
    messages = messagesFromArray(raw.chat_messages);
  } else if (Array.isArray(raw.message_list)) {
    messages = messagesFromArray(raw.message_list);
  }

  if (!messages.length) return null;

  const createdAt = toTimestamp(raw.created_at ?? raw.createdAt ?? raw.inserted_at ?? raw.time);
  const updatedAt = toTimestamp(raw.updated_at ?? raw.updatedAt ?? raw.modified_at ?? createdAt);

  return {
    id: rawId ?? stableId(title, createdAt ?? 0, messages[0]?.content ?? ''),
    title,
    createdAt,
    updatedAt,
    messages,
  };
}

export function stableId(title: string, createdAt: number, firstMessage: string): string {
  let hash = 2166136261;
  const source = `${title}|${createdAt}|${firstMessage}`;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `imp_${(hash >>> 0).toString(36)}`;
}

export function normalizeExport(root: unknown): ImportPreview {
  const arrays = collectConversationArrays(root);
  const warnings: string[] = [];

  if (!arrays.length) {
    return { conversations: 0, messages: 0, skipped: 0, items: [], warnings: ['未找到会话数据，请确认是官方导出的 JSON'] };
  }

  // 取候选数量最多的集合
  const best = arrays.sort((a, b) => b.length - a.length)[0];
  const seen = new Set<string>();
  const items: ImporterConversation[] = [];
  let skipped = 0;
  let messageCount = 0;

  for (const raw of best) {
    const conv = normalizeConversation(raw);
    if (!conv || !conv.messages.length) {
      skipped += 1;
      continue;
    }
    if (seen.has(conv.id)) {
      skipped += 1;
      continue;
    }
    seen.add(conv.id);
    items.push(conv);
    messageCount += conv.messages.length;
  }

  if (skipped) warnings.push(`${skipped} 个会话缺少可解析的消息，已跳过`);

  return {
    conversations: items.length,
    messages: messageCount,
    skipped,
    items,
    warnings,
  };
}

function mergePreviews(previews: ImportPreview[]): ImportPreview {
  const seen = new Set<string>();
  const items: ImporterConversation[] = [];
  let skipped = 0;
  for (const preview of previews) {
    skipped += preview.skipped;
    for (const conv of preview.items) {
      if (seen.has(conv.id)) {
        skipped += 1;
        continue;
      }
      seen.add(conv.id);
      items.push(conv);
    }
  }
  return {
    conversations: items.length,
    messages: items.reduce((sum, c) => sum + c.messages.length, 0),
    skipped,
    items,
    warnings: previews.flatMap((p) => p.warnings),
  };
}

/** 读取用户拖入的文件：支持 .json 单文件与 .zip 导出包 */
export async function parseExportFile(file: File): Promise<ImportPreview> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter(
      (entry) => !entry.dir && entry.name.toLowerCase().endsWith('.json'),
    );
    if (!entries.length) {
      return { conversations: 0, messages: 0, skipped: 0, items: [], warnings: ['压缩包内没有 JSON 文件'] };
    }
    const previews: ImportPreview[] = [];
    for (const entry of entries) {
      const text = await entry.async('string');
      try {
        previews.push(normalizeExport(JSON.parse(text)));
      } catch {
        previews.push({ conversations: 0, messages: 0, skipped: 0, items: [], warnings: [`${entry.name} 解析失败`] });
      }
    }
    return mergePreviews(previews);
  }

  const text = await file.text();
  const json = JSON.parse(text);
  return normalizeExport(json);
}

export function parseExportText(text: string): ImportPreview {
  return normalizeExport(JSON.parse(text));
}
