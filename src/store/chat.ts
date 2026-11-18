import { create } from 'zustand';
import type { ChatMessage, Conversation, ImporterConversation, ModelId } from '../types';
import { db, getMessages, listConversations, putMessages } from '../lib/db';
import { ApiError, chatCompletion, estimateTokens } from '../lib/deepseek';
import { createWebSession, webChat } from '../lib/web';
import { calcCost, titleFromText, trimContext } from '../lib/usage';
import { decideSearch, runSearch } from '../lib/agent';
import { uid } from '../lib/utils';
import { useAuth } from './auth';
import { useSettings } from './settings';

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

interface ChatStore {
  conversations: Conversation[];
  activeId: string | null;
  messages: ChatMessage[];
  streaming: boolean;
  hydrating: boolean;
  toast: Toast | null;

  init: () => Promise<void>;
  refreshList: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  createConversation: () => Promise<Conversation>;
  send: (text: string) => Promise<void>;
  stop: () => void;
  regenerate: (messageId: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  importConversations: (items: ImporterConversation[]) => Promise<{ added: number; merged: number }>;
  notify: (text: string, kind?: 'info' | 'error') => void;
}

let controller: AbortController | null = null;
const webSessions = new Map<string, string>();
let flushTimer: number | null = null;

const currentModel = (): ModelId => useSettings.getState().model;

function buildSystemMessage(conversationId: string): ChatMessage | null {
  const prompt = useSettings.getState().systemPrompt.trim();
  if (!prompt) return null;
  return {
    id: `sys_${conversationId}`,
    conversationId,
    role: 'system',
    content: prompt,
    status: 'done',
    createdAt: 0,
  };
}

export const useChat = create<ChatStore>((set, get) => ({
  conversations: [],
  activeId: null,
  messages: [],
  streaming: false,
  hydrating: true,
  toast: null,

  notify: (text, kind = 'info') => {
    set({ toast: { id: Date.now(), text, kind } });
    window.setTimeout(() => {
      if (get().toast?.text === text) set({ toast: null });
    }, 3600);
  },

  init: async () => {
    const conversations = await listConversations();
    set({ conversations, hydrating: false });
    const settings = useSettings.getState();
    await settings.hydrate();
    if (conversations.length && !get().activeId) {
      await get().selectConversation(conversations[0].id);
    }
  },

  refreshList: async () => {
    set({ conversations: await listConversations() });
  },

  selectConversation: async (id) => {
    const messages = await getMessages(id);
    set({ activeId: id, messages });
  },

  createConversation: async () => {
    const now = Date.now();
    const conversation: Conversation = {
      id: uid('c'),
      title: '新对话',
      createdAt: now,
      updatedAt: now,
      model: currentModel(),
      pinned: false,
      archived: false,
      source: 'native',
      messageCount: 0,
    };
    await db.conversations.put(conversation);
    set((state) => ({ conversations: [conversation, ...state.conversations], activeId: conversation.id, messages: [] }));
    return conversation;
  },

  stop: () => {
    controller?.abort();
    controller = null;
  },

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().streaming) return;

    let conversation = get().conversations.find((item) => item.id === get().activeId) ?? null;
    if (!conversation) conversation = await get().createConversation();

    const conversationId = conversation.id;
    const now = Date.now();
    const userMessage: ChatMessage = {
      id: uid('u'),
      conversationId,
      role: 'user',
      content: trimmed,
      status: 'done',
      createdAt: now,
    };

    const history = [...get().messages, userMessage];
    set({ messages: history });
    await putMessages([userMessage]);

    const patch: Partial<Conversation> = { updatedAt: now };
    if (conversation.messageCount === 0 || conversation.title === '新对话') {
      patch.title = titleFromText(trimmed);
    }
    await db.conversations.update(conversationId, patch);
    await get().refreshList();

    await runAssistant(conversationId, history);
  },

  regenerate: async (messageId) => {
    if (get().streaming) return;
    const messages = get().messages;
    const index = messages.findIndex((item) => item.id === messageId);
    if (index < 0) return;
    const removed = messages.slice(index);
    const keep = messages.slice(0, index);
    await db.messages.bulkDelete(removed.map((item) => item.id));
    set({ messages: keep });
    await get().refreshList();
    await runAssistant(get().activeId as string, keep);
  },

  deleteConversation: async (id) => {
    await db.messages.where('conversationId').equals(id).delete();
    await db.conversations.delete(id);
    const remaining = get().conversations.filter((item) => item.id !== id);
    set({ conversations: remaining });
    if (get().activeId === id) {
      if (remaining[0]) await get().selectConversation(remaining[0].id);
      else set({ activeId: null, messages: [] });
    }
  },

  renameConversation: async (id, title) => {
    const value = title.trim() || '新对话';
    await db.conversations.update(id, { title: value });
    await get().refreshList();
  },

  togglePin: async (id) => {
    const target = get().conversations.find((item) => item.id === id);
    if (!target) return;
    await db.conversations.update(id, { pinned: !target.pinned });
    await get().refreshList();
  },

  deleteMessage: async (id) => {
    await db.messages.delete(id);
    set({ messages: get().messages.filter((item) => item.id !== id) });
    await get().refreshList();
  },

  importConversations: async (items) => {
    let added = 0;
    let merged = 0;
    for (const item of items) {
      const existing = await db.conversations.get(item.id);
      const createdAt = item.createdAt ?? Date.now();
      const updatedAt = item.updatedAt ?? createdAt;
      if (existing) {
        const oldMessages = await getMessages(item.id);
        if (item.messages.length > oldMessages.length) {
          await db.messages.where('conversationId').equals(item.id).delete();
          await db.messages.bulkPut(
            item.messages.map((message, index) => ({
              id: `${item.id}_${index}`,
              conversationId: item.id,
              role: message.role,
              content: message.content,
              reasoning: message.reasoning,
              status: 'done' as const,
              createdAt: message.createdAt ?? createdAt + index * 1000,
            })),
          );
          merged += 1;
        }
        await db.conversations.update(item.id, {
          title: item.title,
          updatedAt: Math.max(updatedAt, existing.updatedAt),
          messageCount: item.messages.length,
          source: 'imported',
        });
        continue;
      }

      const conversation: Conversation = {
        id: item.id,
        title: item.title,
        createdAt,
        updatedAt,
        model: 'deepseek-chat',
        pinned: false,
        archived: false,
        source: 'imported',
        messageCount: item.messages.length,
      };
      await db.conversations.put(conversation);
      await db.messages.bulkPut(
        item.messages.map((message, index) => ({
          id: `${item.id}_${index}`,
          conversationId: item.id,
          role: message.role,
          content: message.content,
          reasoning: message.reasoning,
          status: 'done' as const,
          createdAt: message.createdAt ?? createdAt + index * 1000,
        })),
      );
      added += 1;
    }
    await get().refreshList();
    return { added, merged };
  },
}));

/** 组装上下文，调用对应通道，流式写入占位消息 */
async function runAssistant(conversationId: string, history: ChatMessage[]): Promise<void> {
  const store = useChat.getState();
  const settings = useSettings.getState();
  const auth = useAuth.getState();
  const model = currentModel();

  const assistantId = uid('a');
  const placeholder: ChatMessage = {
    id: assistantId,
    conversationId,
    role: 'assistant',
    content: '',
    status: 'streaming',
    createdAt: Date.now(),
    model,
  };

  useChat.setState({ messages: [...history, placeholder], streaming: true });

  const system = buildSystemMessage(conversationId);
  const context = trimContext(system ? [...history, system] : history, settings.contextRounds);

  const buffers = { content: '', reasoning: '' };
  const flush = () => {
    useChat.setState((state) => ({
      messages: state.messages.map((message) =>
        message.id === assistantId
          ? { ...message, content: buffers.content, reasoning: buffers.reasoning }
          : message,
      ),
    }));
  };
  const schedule = () => {
    if (flushTimer !== null) return;
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      flush();
    }, 100);
  };

  controller = new AbortController();
  const signal = controller.signal;

  // —— 最小 Agent：只有「联网搜索」一个工具，模型自己决定搜不搜，最多搜一次 ——
  let searchBlock = '';
  let searchSources: { title: string; url: string }[] = [];
  const note = (text: string) =>
    useChat.setState((state) => ({
      messages: state.messages.map((message) => (message.id === assistantId ? { ...message, content: text } : message)),
    }));

  let promptTokens = 0;
  let completionTokens = 0;

  try {
    if (settings.searchEnabled && auth.mode === 'apikey' && auth.apiKey) {
      const lastUser = [...history].reverse().find((message) => message.role === 'user');
      const question = lastUser?.content ?? '';
      let query: string | null = null;
      try {
        note('正在判断是否需要联网…');
        query = await decideSearch({
          baseUrl: settings.baseUrl,
          apiKey: auth.apiKey,
          question,
          signal,
        });
      } catch {
        query = null;
      }
      if (query) {
        try {
          note(`正在搜索「${query}」…`);
          const result = await runSearch(query, settings, signal);
          searchBlock = result.block;
          searchSources = result.sources;
          note('正在整理搜索结果…');
        } catch (error) {
          const reason = error instanceof Error ? error.message : '搜索失败';
          store.notify(reason, 'error');
        }
      } else {
        note('');
      }
    }

    if (auth.mode === 'web') {
      if (!auth.webToken) throw new ApiError('网页令牌已失效，请重新登录', 401);
      let sessionId = webSessions.get(conversationId);
      if (!sessionId) {
        sessionId = await createWebSession(auth.webToken, signal);
        webSessions.set(conversationId, sessionId);
      }
      const prompt = context
        .filter((message) => message.role !== 'system')
        .map((message) => `${message.role === 'user' ? '用户' : '助手'}: ${message.content}`)
        .join('\n\n');
      await webChat({
        token: auth.webToken,
        sessionId,
        parentMessageId: null,
        prompt,
        thinking: model === 'deepseek-reasoner',
        signal,
        onDelta: (delta) => {
          buffers.content += delta;
          schedule();
        },
        onReasoning: (delta) => {
          buffers.reasoning += delta;
          schedule();
        },
      });
      promptTokens = estimateTokens(prompt);
      completionTokens = estimateTokens(buffers.content);
    } else {
      if (!auth.apiKey) throw new ApiError('请先登录 API Key', 401);
      const result = await chatCompletion({
        baseUrl: settings.baseUrl,
        apiKey: auth.apiKey,
        model,
        messages: [
          ...(searchBlock ? [{ role: 'system' as const, content: searchBlock }] : []),
          ...context.map((message) => ({
            role: message.role,
            content: message.role === 'system' ? `[系统设定] ${message.content}` : message.content,
          })),
        ],
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        signal,
        onDelta: (delta) => {
          buffers.content += delta;
          schedule();
        },
        onReasoning: (delta) => {
          buffers.reasoning += delta;
          schedule();
        },
      });
      promptTokens = result.promptTokens || estimateTokens(context.map((m) => m.content).join('\n'));
      completionTokens = result.completionTokens || estimateTokens(buffers.content);
    }

    if (flushTimer !== null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }

    if (searchSources.length) {
      const list = searchSources.map((item, index) => `${index + 1}. [${item.title}](${item.url})`).join('\n');
      buffers.content += `\n\n---\n**搜索来源**\n${list}`;
    }

    const finished: ChatMessage = {
      ...placeholder,
      content: buffers.content,
      reasoning: buffers.reasoning,
      status: 'done',
      promptTokens,
      completionTokens,
    };
    useChat.setState((state) => ({
      messages: state.messages.map((message) => (message.id === assistantId ? finished : message)),
      streaming: false,
    }));
    await putMessages([finished]);

    const cost = calcCost(model, promptTokens, completionTokens, settings.pricing);
    await db.usage.add({
      conversationId,
      model,
      promptTokens,
      completionTokens,
      cost,
      at: Date.now(),
    });
    await useChat.getState().refreshList();
  } catch (error) {
    if (flushTimer !== null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    const aborted = (error as Error)?.name === 'AbortError';
    const message = aborted
      ? '已停止生成'
      : error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : '生成失败';

    const failed: ChatMessage = {
      ...placeholder,
      content: buffers.content,
      reasoning: buffers.reasoning,
      status: aborted ? 'interrupted' : 'error',
    };
    useChat.setState((state) => ({
      messages: state.messages.map((item) => (item.id === assistantId ? failed : item)),
      streaming: false,
    }));
    if (buffers.content) await putMessages([failed]);

    if (aborted) {
      store.notify('已停止生成');
    } else {
      store.notify(message, 'error');
      if (error instanceof ApiError && error.status === 401) {
        void useAuth.getState().init();
      }
    }
    await useChat.getState().refreshList();
  } finally {
    controller = null;
  }
}
