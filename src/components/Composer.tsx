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
    <div className="mx-auto w-full max-w-[780px] px-4 pb-3">
      <div className="rounded-card border border-line bg-[color:var(--composer-bg)] px-3 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
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
          className="max-h-[200px] w-full resize-none bg-transparent px-1 py-1 text-[15px] leading-7 outline-none placeholder:text-muted"
        />
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="附件（一期暂不支持）"
              className="rounded-lg p-2 text-muted opacity-60"
              disabled
            >
              <Paperclip size={18} />
            </button>
            <button
              type="button"
              onClick={() =>
                patch({ model: model === 'deepseek-chat' ? 'deepseek-reasoner' : 'deepseek-chat' })
              }
              className={`rounded-full px-3 py-1.5 text-[12.5px] transition ${
                model === 'deepseek-reasoner'
                  ? 'bg-[color:var(--brand-soft)] text-brand'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {model === 'deepseek-reasoner' ? '深度思考' : '普通对话'}
            </button>
          </div>
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--bg-card)] text-ink transition hover:opacity-80"
              title="停止生成"
            >
              <Square size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                canSend ? 'bg-brand text-white hover:opacity-90' : 'bg-[color:var(--bg-card)] text-muted'
              }`}
              title="发送"
            >
              <ArrowUp size={17} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">
        内容由 AI 生成，请仔细甄别 · 非官方客户端，密钥仅存于本机
      </p>
    </div>
  );
}
