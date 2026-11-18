import { useState } from 'react';
import { ClipboardPaste, Eye, EyeOff, Globe, KeyRound, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { credentialLabel, detectCredential, normalizeCredential } from '../lib/credential';
import { canUseNativeLogin, nativeWebLogin } from '../lib/nativeLogin';

export function LoginScreen() {
  const [input, setInput] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const loginAuto = useAuth((state) => state.loginAuto);
  const baseUrl = useSettings((state) => state.baseUrl);

  const kind = detectCredential(normalizeCredential(input));
  const nativeLoginReady = canUseNativeLogin();

  const submit = async (raw?: string) => {
    const value = raw ?? input;
    setBusy(true);
    setError('');
    setHint('');
    try {
      const result = await loginAuto(value, baseUrl);
      if (!result.ok) setError(result.message);
    } finally {
      setBusy(false);
    }
  };

  const useClipboard = async () => {
    setError('');
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) {
        setHint('剪贴板是空的，请先复制再点这个按钮');
        return;
      }
      setInput(text.trim());
      setHint('已从剪贴板填入，确认无误后点「登录」');
      if (detectCredential(normalizeCredential(text)) !== 'unknown') await submit(text);
    } catch {
      setHint('浏览器没有授予剪贴板权限，请手动粘贴');
    }
  };

  const useNativeLogin = async () => {
    setBusy(true);
    setError('');
    setHint('已打开官方登录页，登录成功会自动把令牌带回来');
    try {
      const result = await nativeWebLogin();
      if (result.cancelled) {
        setHint('已取消登录');
        return;
      }
      if (!result.token) {
        setError('没有取到登录令牌，请改用粘贴方式');
        return;
      }
      setInput(result.token);
      const logged = await loginAuto(result.token, baseUrl);
      if (!logged.ok) setError(logged.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'App 内登录失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-[color:var(--bg-page)] px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size={52} />
          <h1 className="mt-4 text-[20px] font-semibold">登录 DeepSeek API 版</h1>
          <p className="mt-1.5 text-[13px] leading-6 text-muted">
            粘贴 API Key 或官方登录令牌，自动识别通道
          </p>
        </div>

        <div className="rounded-[18px] border border-line bg-[color:var(--bg-surface)] p-4">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium">登录凭证</label>
            <button
              type="button"
              onClick={useClipboard}
              className="flex items-center gap-1 text-[12px] text-brand"
            >
              <ClipboardPaste size={13} /> 从剪贴板填入
            </button>
          </div>

          <div className="mt-2 flex items-start gap-2 rounded-xl border border-line bg-[color:var(--bg-card)] px-3 py-2.5">
            <input
              type={visible ? 'text' : 'password'}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !busy && input.trim()) void submit();
              }}
              placeholder="sk-... 或 eyJhbGciOi...（两者都行）"
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => setVisible((value) => !value)}
              className="mt-0.5 shrink-0 text-muted"
              aria-label="显示或隐藏凭证"
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
            {kind === 'apikey' ? (
              <KeyRound size={13} className="text-brand" />
            ) : (
              <Globe size={13} className="text-brand" />
            )}
            {credentialLabel(kind)}
          </p>

          {nativeLoginReady && (
            <button
              type="button"
              onClick={useNativeLogin}
              disabled={busy}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-[color:var(--bg-card)] py-2.5 text-[13px] transition hover:border-brand disabled:opacity-60"
            >
              <Globe size={14} className="text-brand" />
              在 App 内登录官方账号（自动带回令牌）
            </button>
          )}
        </div>

        {(error || hint) && (
          <p className={`mt-3 text-[12.5px] leading-5 ${error ? 'text-[color:#e5484d]' : 'text-muted'}`}>
            {error || hint}
          </p>
        )}

        <button
          type="button"
          onClick={() => submit()}
          disabled={busy || !input.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-[14px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
          登录
        </button>

        <button
          type="button"
          onClick={() => setHelpOpen((value) => !value)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 text-[12px] text-muted"
        >
          <ShieldCheck size={13} /> 两种凭证从哪里来？
        </button>

        {helpOpen && (
          <div className="fade-in mt-3 space-y-3 rounded-[14px] bg-[color:var(--bg-card)] p-3.5 text-[12px] leading-5 text-muted">
            <div>
              <p className="font-medium text-ink">API Key（推荐，按 API 用量计费）</p>
              <p>
                打开{' '}
                <a
                  className="text-brand"
                  href="https://platform.deepseek.com/api_keys"
                  target="_blank"
                  rel="noreferrer"
                >
                  开放平台 API keys
                </a>
                ，创建后复制 <code>sk-</code> 开头的密钥。登录前会先请求一次余额接口，无效密钥不会入库。
              </p>
            </div>
            <div>
              <p className="font-medium text-ink">官方网页令牌（不产生 API 账单，稳定性弱一些）</p>
              <p>
                安卓 App 里点「在 App 内登录官方账号」，在弹出的官方页面完成登录，令牌自动回填；
                网页版则在浏览器登录 chat.deepseek.com 后，从开发者工具 Local Storage 复制
                <code> userToken</code> 粘贴进来。该通道依赖官方网页接口，官方改版可能失效。
              </p>
            </div>
            <div>
              <p className="font-medium text-ink">凭证怎么保管</p>
              <p>两类凭证都用 AES-GCM 加密后存本机，不上传任何服务器；清除应用数据会一并删除。</p>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-[11.5px] leading-5 text-muted">
          本项目为非官方开源客户端，与 DeepSeek 官方无隶属关系。<br />
          请自行遵守官方服务条款，妥善保管账号与凭证。
        </p>
      </div>
    </div>
  );
}
