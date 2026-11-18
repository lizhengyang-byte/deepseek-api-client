import { Plus, Search, Settings2, Sun, Moon, PanelLeft, Upload } from 'lucide-react';
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
  compact?: boolean;
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onOpenSettings,
  onOpenImport,
  onToggleTheme,
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
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Logo size={26} />
        <span className="text-[15px] font-semibold">DeepSeek</span>
        <button
          type="button"
          onClick={onToggleTheme}
          className="ml-auto rounded-lg p-1.5 text-muted hover:text-ink"
          title="切换主题"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-lg p-1.5 text-muted hover:text-ink"
          title="设置"
        >
          <Settings2 size={16} />
        </button>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-[14px] font-medium text-white transition hover:opacity-90"
        >
          <Plus size={16} /> 开启新对话
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-[color:var(--bg-surface)] px-2.5 py-1.5">
          <Search size={15} className="text-muted" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索对话"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <div className="stable-scrollbar mt-2 flex-1 overflow-y-auto px-2 pb-4">
        {groups.map(([label, items]) => (
          <div key={label} className="mt-2">
            <p className="px-2 py-1 text-[11.5px] text-muted">{label}</p>
            {items.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelect(conv.id)}
                className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-[9px] text-left text-[13.5px] transition ${
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
      </div>

      <div className="border-t border-line px-2 py-2">
        <button
          type="button"
          onClick={onOpenImport}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-muted transition hover:bg-[color:var(--bg-surface)] hover:text-ink"
        >
          <Upload size={15} /> 导入官方数据
        </button>
      </div>
    </aside>
  );
}
