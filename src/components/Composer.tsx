import { useEffect, useRef } from 'react';
import { ArrowUp, Paperclip, Square } from 'lucide-react';
import { useSettings } from '../store/settings';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
}

export function Composer({ value, onChange, onSend, onStop, streaming, disabled }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const model = useSettings((state) => state.model);
  const patch = useSettings((state) => state.patch);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !streaming && !disabled;

  return (
    <div className="mx-auto w-full max-w-[780px] px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-1">
      <div className="rounded-[22px] border border-line bg-[color:var(--composer-bg)] px-3 py-2.5 shadow-[0_2px_14px_rgba(17,20,30,0.05)] transition focus-within:border-brand/45 focus-within:shadow-[0_4px_20px_rgba(77,107,254,0.10)]">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder="给 DeepSeek 发送消息"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
          className="max-h-[200px] w-full resize-none bg-transparent px-1 py-1 text-[15px] leading-7 outline-none placeholder:text-muted disabled:opacity-60"
        />
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="附件（一期暂不支持）"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted opacity-50"
              disabled
            >
              <Paperclip size={17} />
            </button>
            <button
              type="button"
              onClick={() =>
                patch({ model: model === 'deepseek-chat' ? 'deepseek-reasoner' : 'deepseek-chat' })
              }
              className={`rounded-full px-2.5 py-1.5 text-[12.5px] transition active:scale-95 ${
                model === 'deepseek-reasoner'
                  ? 'bg-[color:var(--brand-soft)] font-medium text-brand'
                  : 'text-muted hover:bg-[color:var(--bg-card)] hover:text-ink'
              }`}
            >
              {model === 'deepseek-reasoner' ? '深度思考' : '普通对话'}
            </button>
          </div>
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--bg-card)] text-ink transition hover:opacity-80 active:scale-95"
              title="停止生成"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition active:scale-95 ${
                canSend ? 'bg-brand text-white hover:opacity-90' : 'bg-[color:var(--bg-card)] text-muted/70'
              }`}
              title="发送"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] leading-4 text-muted">
        内容由 AI 生成，请仔细甄别 · 非官方客户端，密钥仅存于本机
      </p>
    </div>
  );
}
