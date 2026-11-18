import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useSettings } from '../store/settings';

/**
 * 搜索接口配置。只保留最小必要项：一个服务类型、一个地址、一个密钥。
 * 默认不启用；保存即开启联网搜索。
 */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings((state) => state.searchEnabled);
  const provider = useSettings((state) => state.searchProvider);
  const endpoint = useSettings((state) => state.searchEndpoint);
  const key = useSettings((state) => state.searchKey);
  const patch = useSettings((state) => state.patch);

  const [form, setForm] = useState({ provider, endpoint, key });
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ provider, endpoint, key });
      setError('');
    }
  }, [open, provider, endpoint, key]);

  if (!open) return null;

  const save = () => {
    const value = { ...form, endpoint: form.endpoint.trim(), key: form.key.trim() };
    if (value.provider !== 'tavily' && !value.endpoint) {
      setError('请填写搜索接口地址');
      return;
    }
    if (value.provider === 'tavily' && !value.key) {
      setError('请填写 Tavily API Key');
      return;
    }
    patch({ ...value, searchEnabled: true });
    onClose();
  };

  const hints: Record<typeof form.provider, string> = {
    searxng: '填自建 SearXNG 地址，需开启 JSON 输出，例如 https://searx.example.com',
    tavily: 'Tavily 提供免部署搜索，地址可留默认 https://api.tavily.com/search',
    custom: '任意返回 {"results":[{"title","url","content"}]} 的接口，会用 ?q= 拼接关键词',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="mask-in absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="pop-in relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-line bg-[color:var(--bg-surface)] shadow-[var(--shadow-float)]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="text-[15px] font-medium">联网搜索</p>
            <p className="mt-0.5 text-[12px] text-muted">开启后由模型自己判断是否检索一次</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-ink"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="flex gap-2">
            {(
              [
                ['searxng', 'SearXNG'],
                ['tavily', 'Tavily'],
                ['custom', '自定义'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setForm((value) => ({ ...value, provider: id }))}
                className={`flex-1 rounded-lg border px-2 py-2 text-[13px] transition ${
                  form.provider === id
                    ? 'border-brand/50 bg-[color:var(--brand-soft)] font-medium text-brand'
                    : 'border-line text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-[12px] text-muted">接口地址</label>
            <input
              value={form.endpoint}
              onChange={(event) => setForm((value) => ({ ...value, endpoint: event.target.value }))}
              placeholder={form.provider === 'tavily' ? 'https://api.tavily.com/search' : 'https://…'}
              className="w-full rounded-lg border border-line bg-[color:var(--bg-card)] px-3 py-2 text-[13px] outline-none focus:border-brand/50"
            />
            <p className="mt-1 text-[11px] leading-4 text-muted">{hints[form.provider]}</p>
          </div>

          {form.provider !== 'searxng' && (
            <div>
              <label className="mb-1 block text-[12px] text-muted">API Key</label>
              <input
                type="password"
                value={form.key}
                onChange={(event) => setForm((value) => ({ ...value, key: event.target.value }))}
                placeholder={form.provider === 'tavily' ? 'tvly-…' : '可选'}
                className="w-full rounded-lg border border-line bg-[color:var(--bg-card)] px-3 py-2 text-[13px] outline-none focus:border-brand/50"
              />
            </div>
          )}

          {error && <p className="text-[12px] text-[color:#e5484d]">{error}</p>}
          {!settings && form.endpoint === '' && (
            <p className="text-[11px] leading-4 text-muted">搜索由你自带的接口完成，本应用不代管密钥。</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-[13px] text-muted hover:text-ink">
            取消
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white transition active:scale-95"
          >
            保存并开启
          </button>
        </div>
      </div>
    </div>
  );
}
