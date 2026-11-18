/**
 * 链接直连导入：把「官方数据导出」的下载链接直接抓成 File，交给现有解析器。
 *
 * 官方导出的文件通常挂在受保护的对象存储上：
 * - 带签名参数的公开链接：可直接 GET；
 * - 需要登录 cookie 的链接：浏览器内可能被 CORS 拦截，此时给出可操作的提示，
 *   而不是让用户面对一个含糊的网络错误。
 */

const MAX_BYTES = 200 * 1024 * 1024;

export class LinkImportError extends Error {
  kind: 'invalid' | 'network' | 'cors' | 'http' | 'too-large' | 'not-archive';
  constructor(message: string, kind: LinkImportError['kind']) {
    super(message);
    this.name = 'LinkImportError';
    this.kind = kind;
  }
}

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const last = path.split('/').filter(Boolean).pop() ?? '';
    return last || `deepseek-export-${Date.now()}.zip`;
  } catch {
    return `deepseek-export-${Date.now()}.zip`;
  }
}

export function validateLink(raw: string): string {
  const value = (raw ?? '').trim();
  if (!value) throw new LinkImportError('请先粘贴下载链接', 'invalid');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new LinkImportError('链接格式不正确，请粘贴以 http(s):// 开头的完整地址', 'invalid');
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new LinkImportError('只支持 http(s) 链接', 'invalid');
  }
  return parsed.toString();
}

export async function fetchExportFromLink(rawUrl: string, signal?: AbortSignal): Promise<File> {
  const url = validateLink(rawUrl);

  let res: Response;
  try {
    res = await fetch(url, { signal, credentials: 'include', redirect: 'follow' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new LinkImportError(
      '下载被拦截：官方导出链接通常需要登录态，跨域时浏览器会直接拒绝。可在浏览器里打开该链接下载，再把文件拖进「本地文件」。',
      'cors',
    );
  }

  if (!res.ok) {
    const hint =
      res.status === 401 || res.status === 403
        ? '链接已失效或没有访问权限：请回到官方「数据导出」页面重新复制最新链接（多数链接几十分钟后过期）。'
        : res.status === 404
          ? '链接指向的文件不存在，请确认复制的是下载地址而不是页面地址。'
          : '下载失败，请稍后重试或改为本地文件导入。';
    throw new LinkImportError(`${hint}（HTTP ${res.status}）`, 'http');
  }

  const length = Number(res.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) throw new LinkImportError('文件超过 200MB，请改用本地文件导入', 'too-large');

  const blob = await res.blob();
  if (blob.size > MAX_BYTES) throw new LinkImportError('文件超过 200MB，请改用本地文件导入', 'too-large');
  if (blob.size < 1024) throw new LinkImportError('下载到的内容过小，可能被登录页替换，请检查链接', 'not-archive');

  const name = fileNameFromUrl(url);
  return new File([blob], name, { type: blob.type || 'application/zip' });
}
