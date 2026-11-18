import type { ChatMessage, Conversation, ModelId, Pricing } from '../types';

export const DEFAULT_PRICING: Record<ModelId, Pricing> = {
  // 示例价格（人民币/百万 tokens），请在设置页按官方最新价格调整
  'deepseek-chat': { currency: 'CNY', inputPerMillion: 1, outputPerMillion: 2 },
  'deepseek-reasoner': { currency: 'CNY', inputPerMillion: 2, outputPerMillion: 4 },
};

export function calcCost(
  model: ModelId,
  promptTokens: number,
  completionTokens: number,
  pricing: Record<ModelId, Pricing>,
): number {
  const table = pricing[model] ?? DEFAULT_PRICING[model];
  const input = (promptTokens / 1_000_000) * table.inputPerMillion;
  const output = (completionTokens / 1_000_000) * table.outputPerMillion;
  return Number((input + output).toFixed(4));
}

export function formatCost(value: number): string {
  if (!value) return '¥0.0000';
  if (value < 0.0001) return '<¥0.0001';
  return `¥${value.toFixed(4)}`;
}

/** 按上下文预算裁剪消息，从最新往旧累计，保留 system 头 */
export function trimContext(
  messages: ChatMessage[],
  maxRounds: number,
): ChatMessage[] {
  const usable = messages.filter((m) => m.role !== 'system' && m.content.trim());
  const maxMessages = Math.max(2, maxRounds * 2);
  const sliced = usable.slice(-maxMessages);
  const system = messages.find((m) => m.role === 'system');
  return system ? [system, ...sliced] : sliced;
}

export function titleFromText(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '新对话';
  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}…` : cleaned;
}

export function conversationToMarkdown(conv: Conversation, messages: ChatMessage[]): string {
  const lines = [`# ${conv.title}`, '', `> 导出时间：${new Date().toISOString()}`, ''];
  for (const message of messages) {
    const label = message.role === 'user' ? '你' : message.role === 'assistant' ? 'DeepSeek' : '系统';
    lines.push(`## ${label}`, '', message.content, '');
  }
  return lines.join('\n');
}
