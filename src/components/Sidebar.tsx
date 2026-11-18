import { Plus, Search, Settings2, Sun, Moon, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Conversation } from '../types';
import { groupLabel } from '../lib/utils';
import { Logo } from './Logo';
import { useSettings } from '../store/settings';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onOpenSettings: () => void;
  onOpenImport: () => void;
  onToggleTheme: () => void;
  /** 抽屉模式下传入关闭回调，关闭键会作为头部右侧的常规按钮参与布局 */
  onClose?: () => void;
  compact?: boolean;
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-[color:var(--bg-surface)] hover:text-ink active:scale-95"
    >
      {children}
    </button>
  );
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onOpenSettings,
  onOpenImport,
  onToggleTheme,
  onClose,
  compact,
}: Props) {
  const [keyword, setKeyword] = useState('');
  const theme = useSettings((state) => state.theme);

  const groups = useMemo(() => {
    const filtered = keyword.trim()
      ? conversations.filter((conv) => conv.title.toLowerCase().includes(keyword.trim().toLowerCase()))
      : conversations;
    const map = new Map<string, Conversation[]>();
    const pinned = filtered.filter((conv) => conv.pinned);
    const rest = filtered.filter((conv) => !conv.pinned);
    if (pinned.length) map.set('置顶', pinned);
    for (const conv of rest) {
      const label = groupLabel(conv.updatedAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(conv);
    }
    return [...map.entries()];
  }, [conversations, keyword]);

  return (
    <aside
      className={`flex h-full flex-col bg-[color:var(--bg-card)] ${
        compact ? 'w-full' : 'w-[268px] border-r border-line'
      }`}
    >
      {/* 头部：Logo + 名称在左，主题 / 设置 / 关闭依次排在右侧，全部为 32px 常规按钮，绝不重叠 */}
      <div
        className={`flex items-center gap-2 px-3 pb-2.5 ${
          compact ? 'pt-[calc(env(safe-area-inset-top)+12px)]' : 'pt-4'
        }`}
      >
        <Logo size={26} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">DeepSeek</span>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="切换主题" onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
          <IconButton label="设置" onClick={onOpenSettings}>
            <Settings2 size={16} />
          </IconButton>
          {compact && onClose && (
            <IconButton label="关闭菜单" onClick={onClose}>
              <X size={17} />
            </IconButton>
          )}
        </div>
      </div>

      <div className="px-3 pt-1">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-[14px] font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          <Plus size={16} /> 开启新对话
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-[color:var(--bg-surface)] px-2.5 py-1.5 transition focus-within:border-brand/50">
          <Search size={15} className="text-muted" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索对话"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => setKeyword('')}
              className="shrink-0 text-muted hover:text-ink"
              aria-label="清除搜索"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="stable-scrollbar mt-1 flex-1 overflow-y-auto px-2 pb-4">
        {groups.map(([label, items]) => (
          <div key={label} className="mt-2">
            <p className="px-2 py-1 text-[11.5px] text-muted">{label}</p>
            {items.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelect(conv.id)}
                className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-[9px] text-left text-[13.5px] transition active:scale-[0.99] ${
                  activeId === conv.id
                    ? 'bg-[color:var(--brand-soft)] text-brand'
                    : 'text-ink hover:bg-[color:var(--bg-surface)]'
                }`}
              >
                <span className="truncate">{conv.title}</span>
                {conv.source === 'imported' && (
                  <span className="ml-auto shrink-0 rounded bg-[color:var(--bg-surface)] px-1 text-[10px] text-muted group-hover:bg-white/60">
                    导入
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
        {!conversations.length && (
          <p className="px-3 pt-6 text-[12.5px] leading-6 text-muted">
            还没有会话。发一条消息，或导入官方导出的数据后继续之前的对话。
          </p>
        )}
        {conversations.length > 0 && !groups.length && (
          <p className="px-3 pt-6 text-[12.5px] leading-6 text-muted">没有匹配的对话</p>
        )}
      </div>

      <div className="border-t border-line px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        <button
          type="button"
          onClick={onOpenImport}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-muted transition hover:bg-[color:var(--bg-surface)] hover:text-ink active:scale-[0.99]"
        >
          <Upload size={15} /> 导入官方数据
        </button>
      </div>
    </aside>
  );
}
