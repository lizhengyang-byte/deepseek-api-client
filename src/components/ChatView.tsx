import { useEffect, useRef, useState } from 'react';
import { Code2, Lightbulb, ListChecks, Menu, MoreHorizontal, PenLine, Trash2, Pencil, Pin } from 'lucide-react';
import type { ChatMessage, Conversation } from '../types';
import { MessageItem } from './MessageItem';
import { Composer } from './Composer';
import { Logo } from './Logo';
import { useChat } from '../store/chat';
import { SearchDialog } from './SearchDialog';

interface Props {
  conversation: Conversation | null;
  messages: ChatMessage[];
  streaming: boolean;
  onOpenMenu: () => void;
}

const SUGGESTIONS = [
  { title: '帮我解释一个概念', desc: '用通俗的比喻讲清反向传播', icon: Lightbulb },
  { title: '写一段代码', desc: '用 TypeScript 实现 LRU 缓存', icon: Code2 },
  { title: '润色一段文字', desc: '把工作总结改得更有说服力', icon: PenLine },
  { title: '整理一份清单', desc: '三天成都 citywalk 行程安排', icon: ListChecks },
];

export function ChatView({ conversation, messages, streaming, onOpenMenu }: Props) {
  const [input, setInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchSetup, setSearchSetup] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const send = useChat((state) => state.send);
  const stop = useChat((state) => state.stop);
  const regenerate = useChat((state) => state.regenerate);
  const deleteMessage = useChat((state) => state.deleteMessage);
  const renameConversation = useChat((state) => state.renameConversation);
  const togglePin = useChat((state) => state.togglePin);
  const deleteConversation = useChat((state) => state.deleteConversation);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setInput('');
    stickToBottom.current = true;
  }, [conversation?.id]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const submit = () => {
    const text = input;
    if (!text.trim()) return;
    setInput('');
    stickToBottom.current = true;
    void send(text);
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[color:var(--bg-page)]">
      <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-line bg-[color:var(--bg-page)]/95 px-2 backdrop-blur">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:text-ink active:scale-95 lg:hidden"
          aria-label="打开菜单"
        >
          <Menu size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-tight">{conversation?.title ?? 'DeepSeek'}</p>
          {conversation?.source === 'imported' && (
            <p className="text-[11px] leading-4 text-muted">来自官方导出数据</p>
          )}
        </div>
        {conversation && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:text-ink active:scale-95"
              aria-label="更多操作"
            >
              <MoreHorizontal size={19} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="pop-in absolute right-0 top-10 z-20 w-40 overflow-hidden rounded-xl border border-line bg-[color:var(--bg-surface)] py-1 shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-[13px] hover:bg-[color:var(--bg-card)]"
                    onClick={() => {
                      const title = window.prompt('重命名对话', conversation.title);
                      if (title) void renameConversation(conversation.id, title);
                      setMenuOpen(false);
                    }}
                  >
                    <Pencil size={14} /> 重命名
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-[13px] hover:bg-[color:var(--bg-card)]"
                    onClick={() => {
                      void togglePin(conversation.id);
                      setMenuOpen(false);
                    }}
                  >
                    <Pin size={14} /> {conversation.pinned ? '取消置顶' : '置顶'}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[color:#e5484d] hover:bg-[color:var(--bg-card)]"
                    onClick={() => {
                      if (window.confirm('删除这个对话？该操作不可撤销。')) {
                        void deleteConversation(conversation.id);
                      }
                      setMenuOpen(false);
                    }}
                  >
                    <Trash2 size={14} /> 删除对话
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      <div ref={listRef} onScroll={handleScroll} className="stable-scrollbar flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-[780px] flex-col justify-center px-6 pb-10">
            <div className="fade-in">
              <div className="flex items-center gap-3">
                <Logo size={42} />
                <div>
                  <h1 className="text-[22px] font-semibold leading-tight">我是 DeepSeek，很高兴见到你！</h1>
                  <p className="mt-1 text-[13.5px] text-muted">可以使用自己的 API 余额继续之前的对话</p>
                </div>
              </div>
              <div className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      setInput(item.desc);
                    }}
                    className="group rounded-card border border-line bg-[color:var(--bg-card)] px-4 py-3 text-left transition hover:border-brand/40 hover:bg-[color:var(--brand-soft)] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-1.5">
                      <item.icon size={14} className="text-brand" />
                      <p className="text-[13.5px] font-medium">{item.title}</p>
                    </div>
                    <p className="mt-1 pl-[22px] text-[12px] leading-5 text-muted">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[780px] px-4 py-4">
            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                streaming={streaming}
                onRegenerate={(id) => void regenerate(id)}
                onDelete={(id) => {
                  if (window.confirm('删除这条消息？')) void deleteMessage(id);
                }}
              />
            ))}
            <div className="h-4" />
          </div>
        )}
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSend={submit}
        onStop={stop}
        streaming={streaming}
        onConfigureSearch={() => setSearchSetup(true)}
      />
      <SearchDialog open={searchSetup} onClose={() => setSearchSetup(false)} />
    </div>
  );
}
