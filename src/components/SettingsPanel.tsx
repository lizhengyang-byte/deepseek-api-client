import { useState } from 'react';
import { Download, LogOut, Moon, Sun, Upload, X, Trash2 } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { useChat } from '../store/chat';
import { buildBackup } from '../lib/export';
import { downloadFile } from '../lib/utils';
import { maskSecret } from '../lib/crypto';
import { db } from '../lib/db';

interface Props {
  onClose: () => void;
  onOpenImport: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4 last:border-none">
      <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-muted">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13.5px]">{label}</p>
        {hint && <p className="mt-0.5 text-[11.5px] leading-4 text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPanel({ onClose, onOpenImport }: Props) {
  const settings = useSettings();
  const auth = useAuth();
  const notify = useChat((state) => state.notify);
  const refreshList = useChat((state) => state.refreshList);
  const [tab, setTab] = useState<'account' | 'model' | 'data'>('account');

  const exportAll = async () => {
    const backup = await buildBackup();
    downloadFile(JSON.stringify(backup, null, 2), `deepseek-backup-${Date.now()}.json`);
    notify('已导出全部会话');
  };

  const clearAll = async () => {
    if (!window.confirm('清空本地全部会话与消息？请先导出备份，操作不可撤销。')) return;
    await db.messages.clear();
    await db.conversations.clear();
    await db.usage.clear();
    await refreshList();
    notify('本地数据已清空');
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/25">
      <div className="fade-in flex h-full w-full max-w-[420px] flex-col bg-[color:var(--bg-surface)] shadow-2xl">
        <div className="flex h-14 items-center justify-between border-b border-line px-5">
          <h2 className="text-[15px] font-semibold">设置</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 border-b border-line text-[13px]">
          {(['account', 'model', 'data'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`py-2.5 transition ${
                tab === item ? 'border-b-2 border-brand font-medium text-brand' : 'text-muted'
              }`}
            >
              {item === 'account' ? '账号' : item === 'model' ? '模型' : '数据'}
            </button>
          ))}
        </div>

        <div className="stable-scrollbar flex-1 overflow-y-auto">
          {tab === 'account' && (
            <>
              <Section title="接入方式">
                <div className="flex rounded-full bg-[color:var(--bg-card)] p-1 text-[13px]">
                  <button
                    type="button"
                    onClick={() => void auth.switchMode('apikey')}
                    disabled={!auth.apiKey}
                    className={`flex-1 rounded-full py-1.5 transition disabled:opacity-40 ${
                      auth.mode === 'apikey' ? 'bg-[color:var(--bg-surface)] font-medium shadow-sm' : 'text-muted'
                    }`}
                  >
                    API Key
                  </button>
                  <button
                    type="button"
                    onClick={() => void auth.switchMode('web')}
                    disabled={!auth.webToken}
                    className={`flex-1 rounded-full py-1.5 transition disabled:opacity-40 ${
                      auth.mode === 'web' ? 'bg-[color:var(--bg-surface)] font-medium shadow-sm' : 'text-muted'
                    }`}
                  >
                    网页通道
                  </button>
                </div>
                <Row label="当前密钥" hint="AES-GCM 加密存储，仅本机可解">
                  <span className="text-[12.5px] text-muted">{maskSecret(auth.apiKey ?? '') || '未设置'}</span>
                </Row>
                <Row label="账户余额" hint="以官方控制台为准">
                  <span className="text-[13px] font-medium">
                    {auth.balance ? `${auth.balance.currency} ${auth.balance.total}` : '—'}
                  </span>
                </Row>
                <button
                  type="button"
                  onClick={() => void auth.refreshBalance(settings.baseUrl)}
                  className="text-[12.5px] text-brand"
                >
                  刷新余额
                </button>
              </Section>
              <Section title="接口地址">
                <input
                  value={settings.baseUrl}
                  onChange={(event) => settings.patch({ baseUrl: event.target.value })}
                  className="w-full rounded-lg border border-line bg-[color:var(--bg-card)] px-3 py-2 text-[12.5px] outline-none"
                />
                <p className="text-[11.5px] text-muted">默认 https://api.deepseek.com，可填自建反向代理。</p>
              </Section>
              <Section title="退出">
                <button
                  type="button"
                  onClick={async () => {
                    await auth.logout();
                    onClose();
                  }}
                  className="flex items-center gap-2 text-[13px] text-[color:#e5484d]"
                >
                  <LogOut size={15} /> 清除本机密钥并退出
                </button>
              </Section>
            </>
          )}

          {tab === 'model' && (
            <>
              <Section title="默认模型">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'deepseek-chat' as const, name: 'DeepSeek-V3', desc: '通用对话，响应快' },
                    { id: 'deepseek-reasoner' as const, name: 'DeepSeek-R1', desc: '深度思考，适合推理' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => settings.patch({ model: item.id })}
                      className={`rounded-card border px-3 py-2.5 text-left transition ${
                        settings.model === item.id
                          ? 'border-brand bg-[color:var(--brand-soft)]'
                          : 'border-line bg-[color:var(--bg-card)]'
                      }`}
                    >
                      <p className="text-[13px] font-medium">{item.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{item.desc}</p>
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="生成参数">
                <Row label={`温度 ${settings.temperature.toFixed(1)}`} hint="越低越稳定，越高越发散">
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.1}
                    value={settings.temperature}
                    onChange={(event) => settings.patch({ temperature: Number(event.target.value) })}
                    className="w-32 accent-[color:var(--brand)]"
                  />
                </Row>
                <Row label="最大输出 tokens">
                  <input
                    type="number"
                    min={256}
                    max={8192}
                    value={settings.maxTokens}
                    onChange={(event) => settings.patch({ maxTokens: Number(event.target.value) })}
                    className="w-24 rounded-lg border border-line bg-[color:var(--bg-card)] px-2 py-1 text-right text-[12.5px] outline-none"
                  />
                </Row>
                <Row label="回传历史轮数" hint="导入会话续聊时参与上下文">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={settings.contextRounds}
                    onChange={(event) => settings.patch({ contextRounds: Number(event.target.value) })}
                    className="w-24 rounded-lg border border-line bg-[color:var(--bg-card)] px-2 py-1 text-right text-[12.5px] outline-none"
                  />
                </Row>
              </Section>
              <Section title="系统提示词">
                <textarea
                  value={settings.systemPrompt}
                  onChange={(event) => settings.patch({ systemPrompt: event.target.value })}
                  rows={4}
                  placeholder="例如：你是一名严谨的土木工程师，回答时给出计算过程。"
                  className="w-full resize-none rounded-lg border border-line bg-[color:var(--bg-card)] px-3 py-2 text-[12.5px] leading-5 outline-none"
                />
              </Section>
              <Section title="计费单价（元 / 百万 tokens）">
                {(['deepseek-chat', 'deepseek-reasoner'] as const).map((model) => (
                  <div key={model} className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px]">{model === 'deepseek-chat' ? 'V3' : 'R1'}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={0.1}
                        value={settings.pricing[model].inputPerMillion}
                        onChange={(event) =>
                          settings.patch({
                            pricing: {
                              ...settings.pricing,
                              [model]: {
                                ...settings.pricing[model],
                                inputPerMillion: Number(event.target.value),
                              },
                            },
                          })
                        }
                        className="w-16 rounded-lg border border-line bg-[color:var(--bg-card)] px-2 py-1 text-right text-[12px] outline-none"
                      />
                      <span className="text-[11px] text-muted">入</span>
                      <input
                        type="number"
                        step={0.1}
                        value={settings.pricing[model].outputPerMillion}
                        onChange={(event) =>
                          settings.patch({
                            pricing: {
                              ...settings.pricing,
                              [model]: {
                                ...settings.pricing[model],
                                outputPerMillion: Number(event.target.value),
                              },
                            },
                          })
                        }
                        className="w-16 rounded-lg border border-line bg-[color:var(--bg-card)] px-2 py-1 text-right text-[12px] outline-none"
                      />
                      <span className="text-[11px] text-muted">出</span>
                    </div>
                  </div>
                ))}
                <p className="text-[11px] leading-4 text-muted">
                  默认值为示例，请以官方最新价格为准；页面内费用均为估算。
                </p>
              </Section>
              <Section title="外观">
                <Row label="主题">
                  <button
                    type="button"
                    onClick={() => settings.patch({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px]"
                  >
                    {settings.theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    {settings.theme === 'dark' ? '浅色' : '深色'}
                  </button>
                </Row>
              </Section>
            </>
          )}

          {tab === 'data' && (
            <>
              <Section title="导入">
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-[color:var(--bg-card)] py-2.5 text-[13px]"
                >
                  <Upload size={15} /> 导入官方导出数据
                </button>
              </Section>
              <Section title="备份">
                <button
                  type="button"
                  onClick={exportAll}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-[13px] font-medium text-white"
                >
                  <Download size={15} /> 导出全部会话 JSON
                </button>
                <p className="text-[11.5px] leading-4 text-muted">
                  导出文件可再次导入本应用，也可作为纯文本备份。
                </p>
              </Section>
              <Section title="危险操作">
                <button
                  type="button"
                  onClick={clearAll}
                  className="flex items-center gap-2 text-[13px] text-[color:#e5484d]"
                >
                  <Trash2 size={15} /> 清空本地会话数据
                </button>
              </Section>
              <Section title="关于">
                <p className="text-[11.5px] leading-5 text-muted">
                  DeepSeek API 版 · 开源非官方客户端。界面参考官方 App 的使用习惯重新实现，
                  不使用官方商标与图形素材。项目以 MIT 许可发布。
                </p>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
