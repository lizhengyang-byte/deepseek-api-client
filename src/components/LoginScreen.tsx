import { useState } from 'react';
import { Eye, EyeOff, Globe, KeyRound, Loader2 } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';

export function LoginScreen() {
  const [tab, setTab] = useState<'apikey' | 'web'>('apikey');
  const [key, setKey] = useState('');
  const [token, setToken] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loginApiKey = useAuth((state) => state.loginApiKey);
  const loginWeb = useAuth((state) => state.loginWeb);
  const baseUrl = useSettings((state) => state.baseUrl);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const result =
        tab === 'apikey' ? await loginApiKey(key, baseUrl) : await loginWeb(token);
      if (!result.ok) setError(result.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-[color:var(--bg-page)] px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={52} />
          <h1 className="mt-4 text-[20px] font-semibold">登录 DeepSeek API 版</h1>
          <p className="mt-1.5 text-[13px] leading-6 text-muted">
            使用官方账号接入，按 API 用量计费
          </p>
        </div>

        <div className="mb-4 flex rounded-full bg-[color:var(--bg-card)] p-1">
          <button
            type="button"
            onClick={() => setTab('apikey')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] transition ${
              tab === 'apikey' ? 'bg-[color:var(--bg-surface)] font-medium shadow-sm' : 'text-muted'
            }`}
          >
            <KeyRound size={14} /> API Key
          </button>
          <button
            type="button"
            onClick={() => setTab('web')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] transition ${
              tab === 'web' ? 'bg-[color:var(--bg-surface)] font-medium shadow-sm' : 'text-muted'
            }`}
          >
            <Globe size={14} /> 官方网页登录
          </button>
        </div>

        {tab === 'apikey' ? (
          <div className="fade-in">
            <label className="text-[13px] font-medium">API Key</label>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-[color:var(--bg-surface)] px-3 py-2.5">
              <input
                type={visible ? 'text' : 'password'}
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted"
              />
              <button type="button" onClick={() => setVisible((v) => !v)} className="text-muted">
                {visible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-muted">
              在开放平台「API keys」页面创建，形如 sk-xxx。密钥经 AES-GCM 加密后只存在本机，
              不会上传到任何服务器。
            </p>
            <a
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-[12px] text-brand"
            >
              去开放平台创建密钥 →
            </a>
          </div>
        ) : (
          <div className="fade-in">
            <p className="text-[12.5px] leading-6 text-muted">
              在浏览器中登录官方网页（chat.deepseek.com），登录后从浏览器本地存储取出
              <b> userToken </b>，粘贴到下方即可用本账号对话。
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px] leading-5 text-muted">
              <li>桌面浏览器按 F12 打开开发者工具 → Application → Local Storage</li>
              <li>找到 chat.deepseek.com 下的 userToken，复制其值</li>
              <li>粘贴到这里，点击连接（仅本机保存）</li>
            </ol>
            <label className="mt-4 block text-[13px] font-medium">网页会话令牌</label>
            <textarea
              value={token}
              onChange={(event) => setToken(event.target.value)}
              rows={4}
              placeholder="粘贴 userToken"
              className="mt-2 w-full resize-none rounded-xl border border-line bg-[color:var(--bg-surface)] px-3 py-2.5 text-[13px] outline-none placeholder:text-muted"
            />
            <p className="mt-2 text-[12px] leading-5 text-muted">
              该通道依赖官方网页非公开接口，可能随官方调整失效；不产生 API 账单，额度按网页账号规则计。
            </p>
          </div>
        )}

        {error && <p className="mt-3 text-[12.5px] text-[color:#e5484d]">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-[14px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {tab === 'apikey' ? '登录并校验密钥' : '连接网页通道'}
        </button>

        <p className="mt-6 text-center text-[11.5px] leading-5 text-muted">
          本项目为非官方开源客户端，与 DeepSeek 官方无隶属关系。<br />
          请自行遵守官方服务条款，妥善保管账号与密钥。
        </p>
      </div>
    </div>
  );
}
