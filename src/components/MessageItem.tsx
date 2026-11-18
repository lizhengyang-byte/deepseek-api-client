import { useState } from 'react';
import { Check, Copy, RotateCcw, Trash2 } from 'lucide-react';
import type { ChatMessage } from '../types';
import { Markdown } from './Markdown';
import { ThinkingBlock } from './ThinkingBlock';
import { Logo } from './Logo';
import { copyText, formatTime } from '../lib/utils';
import { formatCost } from '../lib/usage';
import { useSettings } from '../store/settings';

interface Props {
  message: ChatMessage;
  streaming: boolean;
  onRegenerate: (id: string) => void;
  onDelete: (id: string) => void;
}

function usageLine(message: ChatMessage): string {
  if (!message.promptTokens && !message.completionTokens) return '';
  const pricing = useSettings.getState().pricing;
  const model = message.model ?? 'deepseek-chat';
  const cost = formatCost(
    ((message.promptTokens ?? 0) / 1_000_000) * pricing[model].inputPerMillion +
      ((message.completionTokens ?? 0) / 1_000_000) * pricing[model].outputPerMillion,
  );
  return `${message.promptTokens ?? 0} + ${message.completionTokens ?? 0} tokens · 约 ${cost}`;
}

export function MessageItem({ message, streaming, onRegenerate, onDelete }: Props) {
  const [copied, setCopied] = useState(false);

  if (message.role === 'user') {
    return (
      <div className="msg-in group flex flex-col items-end gap-1 py-3">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-bubble bg-[color:var(--bubble-user)] px-4 py-2.5 text-[15px] leading-7">
          {message.content}
        </div>
        <div className="flex items-center gap-3 pr-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
          <span className="text-[11px] text-muted">{formatTime(message.createdAt)}</span>
          <button
            type="button"
            className="text-muted hover:text-ink"
            title="复制"
            onClick={async () => {
              await copyText(message.content);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            className="text-muted hover:text-ink"
            title="删除"
            onClick={() => onDelete(message.id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  }

  const showCaret = message.status === 'streaming' && streaming && !message.content;

  return (
    <div className="msg-in group py-3">
      <div className="flex gap-3">
        <Logo size={28} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <ThinkingBlock
            text={message.reasoning ?? ''}
            streaming={message.status === 'streaming' && !message.content}
          />
          {message.content ? (
            <Markdown content={message.content} streaming={message.status === 'streaming'} />
          ) : (
            showCaret && <span className="caret" />
          )}
          {message.status === 'error' && (
            <p className="mt-2 text-[13px] text-[color:#e5484d]">生成中断，可点击重新生成再试一次。</p>
          )}
          {message.status === 'interrupted' && (
            <p className="mt-2 text-[13px] text-muted">已停止生成</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
            <button
              type="button"
              className="flex items-center gap-1 hover:text-ink"
              onClick={async () => {
                await copyText(message.content);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? '已复制' : '复制'}
            </button>
            {message.status !== 'streaming' && (
              <button
                type="button"
                className="flex items-center gap-1 hover:text-ink"
                onClick={() => onRegenerate(message.id)}
              >
                <RotateCcw size={13} /> 重新生成
              </button>
            )}
            <button
              type="button"
              className="flex items-center gap-1 hover:text-ink"
              onClick={() => onDelete(message.id)}
            >
              <Trash2 size={13} /> 删除
            </button>
            <span className="ml-auto">{usageLine(message)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
