export type CredentialKind = 'apikey' | 'web' | 'empty' | 'unknown';

const API_KEY = /^sk-[A-Za-z0-9_-]{12,}$/;
const JWT = /^ey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;

/**
 * 自动识别用户粘贴的凭证类型：
 * - 开放平台的 API Key（sk- 开头，按 API 用量计费）
 * - 官方网页的登录令牌（userToken，通常是 JWT；不产生 API 账单）
 * 识别只依据形态，不做任何网络请求，最终能否用还需校验。
 */
export function detectCredential(raw: string): CredentialKind {
  const value = (raw ?? '').trim();
  if (!value) return 'empty';
  if (API_KEY.test(value)) return 'apikey';
  if (JWT.test(value)) return 'web';
  // 官方网页的 userToken 少数情况下不是标准 JWT，按长度与字符集兜底判断
  if (value.length >= 40 && /^[A-Za-z0-9._~+/=-]+$/.test(value) && !value.includes(' ')) return 'web';
  return 'unknown';
}

export function credentialLabel(kind: CredentialKind): string {
  if (kind === 'apikey') return 'API Key（按 API 用量计费）';
  if (kind === 'web') return '官方网页令牌（走网页通道，不计 API 账单）';
  if (kind === 'empty') return '等待粘贴';
  return '未识别的凭证';
}

/** 用户可能把整行 `Authorization: Bearer xxx` 一起复制进来，这里做一次清洗。 */
export function normalizeCredential(raw: string): string {
  return (raw ?? '')
    .trim()
    .replace(/^authorization\s*:\s*/i, '')
    .replace(/^bearer\s+/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
}
