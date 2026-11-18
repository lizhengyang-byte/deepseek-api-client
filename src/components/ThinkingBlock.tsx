import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Markdown } from './Markdown';

export function ThinkingBlock({ text, streaming }: { text: string; streaming?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-full bg-[color:var(--bg-card)] px-3 py-1.5 text-[13px] text-muted transition hover:text-ink"
      >
        <span className="text-brand">✦</span>
        <span>{streaming ? '正在深度思考…' : '已深度思考'}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="fade-in mt-2 rounded-card border border-line bg-[color:var(--bg-card)] px-3.5 py-3 text-[13.5px] text-muted">
          <Markdown content={text} />
        </div>
      )}
    </div>
  );
}
