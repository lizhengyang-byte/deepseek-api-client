import { useState } from 'react';
import { AlertTriangle, Check, FileJson, Link2, Loader2, UploadCloud, X } from 'lucide-react';
import { parseExportFile } from '../lib/importer';
import { fetchExportFromLink, LinkImportError, validateLink } from '../lib/linkImport';
import type { ImportPreview } from '../types';
import { useChat } from '../store/chat';

interface Props {
  onClose: () => void;
}

type Mode = 'file' | 'link';

export function ImportDialog({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>('file');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [link, setLink] = useState('');

  const importConversations = useChat((state) => state.importConversations);
  const notify = useChat((state) => state.notify);

  const consume = async (file: File, label: string) => {
    setBusy(true);
    setError('');
    setPreview(null);
    setStep(`正在解析 ${label}`);
    try {
      const result = await parseExportFile(file);
      if (!result.items.length) {
        setError(result.warnings[0] ?? '没有解析到会话，请确认文件是否为官方导出的数据');
      } else {
        setPreview(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件解析失败');
    } finally {
      setBusy(false);
      setStep('');
    }
  };

  const handleFile = (file: File) => consume(file, file.name);

  const handleLink = async () => {
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      validateLink(link);
      setStep('正在下载压缩包');
      const file = await fetchExportFromLink(link);
      await consume(file, file.name);
    } catch (err) {
      if (err instanceof LinkImportError) setError(err.message);
      else setError(err instanceof Error ? err.message : '下载失败');
      setStep('');
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    const result = await importConversations(preview.items);
    notify(`已导入 ${result.added} 个会话，合并 ${result.merged} 个`);
    setBusy(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="fade-in w-full max-w-[520px] rounded-[20px] bg-[color:var(--bg-surface)] p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">导入官方数据</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-[12.5px] leading-5 text-muted">
          支持官方「设置 → 数据导出」的压缩包：可以直接粘下载链接，也可以选本地文件。全部在本地解析，不会上传。
        </p>

        <div className="mt-4 flex rounded-full bg-[color:var(--bg-card)] p-1">
          <button
            type="button"
            onClick={() => setMode('file')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[12.5px] transition ${
              mode === 'file' ? 'bg-[color:var(--bg-surface)] font-medium shadow-sm' : 'text-muted'
            }`}
          >
            <UploadCloud size={13} /> 本地文件
          </button>
          <button
            type="button"
            onClick={() => setMode('link')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[12.5px] transition ${
              mode === 'link' ? 'bg-[color:var(--bg-surface)] font-medium shadow-sm' : 'text-muted'
            }`}
          >
            <Link2 size={13} /> 下载链接
          </button>
        </div>

        {mode === 'file' ? (
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-4 py-8 transition ${
              dragging ? 'border-brand bg-[color:var(--brand-soft)]' : 'border-line bg-[color:var(--bg-card)]'
            }`}
          >
            {busy ? (
              <Loader2 size={22} className="animate-spin text-brand" />
            ) : (
              <UploadCloud size={22} className="text-brand" />
            )}
            <p className="text-[13px]">点击选择，或把 .zip / .json 拖到这里</p>
            <input
              type="file"
              accept=".zip,.json,application/json,application/zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </label>
        ) : (
          <div className="mt-4">
            <input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="粘贴官方数据导出页面的下载链接（https://...zip）"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-line bg-[color:var(--bg-card)] px-3 py-2.5 text-[13px] outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={handleLink}
              disabled={busy || !link.trim()}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              下载并导入
            </button>
            <p className="mt-2 text-[11.5px] leading-5 text-muted">
              官方导出链接通常带登录态或时效签名：若提示下载被拦截，说明需要登录 cookie，
              请先在该链接所在浏览器里下载，再切到「本地文件」导入。
            </p>
          </div>
        )}

        {step && <p className="mt-2 text-[12px] text-muted">{step}…</p>}

        {error && (
          <p className="mt-3 flex items-start gap-1.5 text-[12.5px] leading-5 text-[color:#e5484d]">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        {preview && (
          <div className="fade-in mt-4 rounded-card bg-[color:var(--bg-card)] p-3.5">
            <div className="flex items-center gap-2 text-[13px]">
              <FileJson size={15} className="text-brand" />
              已解析 <b>{preview.conversations}</b> 个会话，共 <b>{preview.messages}</b> 条消息
              {preview.skipped > 0 && <span className="text-muted">（跳过 {preview.skipped} 条）</span>}
            </div>
            <ul className="mt-2 max-h-[120px] space-y-1 overflow-y-auto text-[12px] text-muted">
              {preview.items.slice(0, 6).map((item) => (
                <li key={item.id} className="truncate">
                  · {item.title} <span className="text-[11px]">({item.messages.length} 条)</span>
                </li>
              ))}
              {preview.items.length > 6 && (
                <li className="text-[11px]">… 以及另外 {preview.items.length - 6} 个会话</li>
              )}
            </ul>
            <p className="mt-2 flex items-center gap-1 text-[11.5px] text-muted">
              <Check size={12} className="text-brand" /> 重复导入只会补齐消息，不会产生重复会话
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-[13.5px] text-muted hover:text-ink"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!preview || busy}
            onClick={confirm}
            className="rounded-xl bg-brand px-4 py-2 text-[13.5px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            导入到本地
          </button>
        </div>
      </div>
    </div>
  );
}
