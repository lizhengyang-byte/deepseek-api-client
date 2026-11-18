import { db, getMessages } from './db';
import type { ChatMessage, Conversation } from '../types';

export interface BackupFile {
  app: 'deepseek-api-client';
  version: 1;
  exportedAt: string;
  conversations: {
    id: string;
    title: string;
    created_at: number;
    updated_at: number;
    messages: { role: string; content: string; reasoning?: string; created_at: number }[];
  }[];
}

export async function buildBackup(): Promise<BackupFile> {
  const conversations = await db.conversations.toArray();
  const result: BackupFile = {
    app: 'deepseek-api-client',
    version: 1,
    exportedAt: new Date().toISOString(),
    conversations: [],
  };

  for (const conv of conversations) {
    const messages = await getMessages(conv.id);
    result.conversations.push({
      id: conv.id,
      title: conv.title,
      created_at: conv.createdAt,
      updated_at: conv.updatedAt,
      messages: messages
        .filter((message) => message.content.trim())
        .map((message) => ({
          role: message.role,
          content: message.content,
          reasoning: message.reasoning,
          created_at: message.createdAt,
        })),
    });
  }
  return result;
}

/** 单会话 Markdown，方便贴到别处继续用 */
export function conversationMarkdown(conv: Conversation, messages: ChatMessage[]): string {
  const header = `# ${conv.title}\n\n> 由 DeepSeek API 版导出 · ${new Date().toLocaleString('zh-CN')}\n`;
  const body = messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      const label = message.role === 'user' ? '你' : 'DeepSeek';
      return `## ${label}\n\n${message.content}`;
    })
    .join('\n\n');
  return `${header}\n${body}\n`;
}
