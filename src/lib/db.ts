import Dexie, { type Table } from 'dexie';
import type { ChatMessage, Conversation, UsageRecord } from '../types';

class DeepSeekDB extends Dexie {
  conversations!: Table<Conversation, string>;
  messages!: Table<ChatMessage, string>;
  usage!: Table<UsageRecord, number>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('deepseek-api-client');
    this.version(1).stores({
      conversations: 'id, updatedAt, pinned, archived, source',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt], status',
      usage: '++id, at, conversationId',
      settings: 'key',
    });
  }
}

export const db = new DeepSeekDB();

export async function listConversations(): Promise<Conversation[]> {
  const all = await db.conversations.toArray();
  return all.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  return db.messages
    .where('[conversationId+createdAt]')
    .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
    .toArray();
}

export async function putMessages(messages: ChatMessage[]): Promise<void> {
  if (!messages.length) return;
  await db.messages.bulkPut(messages);
  const first = messages[0];
  const conv = await db.conversations.get(first.conversationId);
  if (conv) {
    await db.conversations.update(conv.id, {
      updatedAt: Math.max(Date.now(), conv.updatedAt),
      messageCount: await db.messages.where('conversationId').equals(conv.id).count(),
    });
  }
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export async function readSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function estimateUsageSize(): Promise<{ used: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { used: usage, quota };
}
