import { useState } from 'react';
import { X, FileJson, UploadCloud, AlertTriangle, Loader2 } from 'lucide-react';
import { parseExportFile } from '../lib/importer';
import type { ImportPreview } from '../types';
import { useChat } from '../store/chat';

interface Props {
  onClose: () => void;
}

export function ImportDialog({ onClose }: Props) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const importConversations = useChat((state) => state.importConversations);
  const notify = useChat((state) => state.notify);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError('');
    setPreview(null);
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
          支持官方「设置 → 数据导出」下载的压缩包，或其中任意一个 JSON 文件；文件只在本地解析，不会上传。
        </p>

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
          {busy ? <Loader2 size={22} className="animate-spin text-brand" /> : <UploadCloud size={22} className="text-brand" />}
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

        {error && (
          <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-[color:#e5484d]">
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
              {preview.items.length > 6 && <li className="text-[11px]">… 以及另外 {preview.items.length - 6} 个会话</li>}
            </ul>
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
