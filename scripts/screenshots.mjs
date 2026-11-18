/**
 * 界面截图脚本：用真实构建产物 + 拦截官方 API 的假数据，
 * 录下每个界面的真实渲染结果，输出到 docs/screenshots/。
 *
 * 用法：npm run build && node scripts/screenshots.mjs
 * 依赖：playwright（CI 中单独安装）
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = 'dist';
const OUT = 'docs/screenshots';
const PORT = 5180;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const BALANCE = {
  is_available: true,
  balance_infos: [
    { currency: 'CNY', total_balance: '48.62', granted_balance: '8.00', topped_up_balance: '40.62' },
  ],
};

const ANSWER = `WSL2 上跑 DeepSeek 客户端的完整路径可以拆成三步：先让容器与主机网络互通，再把密钥放进本地加密库，最后用反向代理兜住 401 与限流。

### 1. 网络与端口

- WSL2 默认走 NAT，\`localhost\` 转发由 Windows 侧完成；启动服务时务必绑定 \`0.0.0.0\`。
- 若在 Docker 里运行，记得把 \`5180\` 映射到主机，否则浏览器会拿到 \`ERR_EMPTY_RESPONSE\`。

\`\`\`bash
# WSL2 / Ubuntu 24.04
npm install
npm run build
npx vite preview --host 0.0.0.0 --port 5180
\`\`\`

### 2. 密钥存放位置

| 方案 | 安全性 | 适用场景 |
| --- | --- | --- |
| 环境变量 \`DEEPSEEK_API_KEY\` | 中，进程可读 | 临时调试 |
| AES-GCM + IndexedDB | 高，主密钥不可导出 | 日常使用 |
| 明文写进 localStorage | 低，脚本可直接读 | 不建议 |

### 3. 常见错误码

遇到 **401** 说明密钥失效或被删除，清掉本地密文重新登录即可；**402** 是余额不足；**429** 触发限流时等待 3 秒再重试，指数退避两次通常能恢复。
`;

const REASONING = `用户想知道在 WSL2 里部署的客户端为什么连不上官方接口。先确认三件事：绑定地址、端口映射、代理环境变量。

逐条排查：如果 vite preview 只监听 127.0.0.1，Windows 侧通过 localhost 转发其实能通，但 Docker 端口未映射就会失败；其次检查 no_proxy 是否忽略了 localhost，否则请求会被企业代理拦截并返回 502。

结论：先证明网络通，再谈密钥与模型，把排查顺序固化进 README，能省掉大部分重复提问。
`;

const SAMPLE_EXPORT = {
  conversations: [
    {
      id: 'imp-1',
      title: '四川省定额套用疑问',
      created_at: 1760000000,
      messages: [
        { role: 'user', content: '挖一般土方应该套哪条定额？' },
        {
          role: 'assistant',
          content: '按《四川省建设工程工程量清单计价定额》，挖一般土方套用 A.1 土石方工程相应子目。',
        },
      ],
    },
    {
      id: 'imp-2',
      title: 'BIMMAKE 导入 Revit 模型',
      created_at: 1760200000,
      messages: [
        { role: 'user', content: 'BIMMAKE 支持 rvt 吗？' },
        { role: 'assistant', content: '支持直接导入 rvt，也支持 glTF 与 3DS。' },
      ],
    },
    {
      id: 'imp-3',
      title: '毕业设计进度汇报提纲',
      created_at: 1760400000,
      messages: [
        { role: 'user', content: '帮我列一份三分钟的汇报提纲。' },
        { role: 'assistant', content: '一、选题背景；二、已完成工作；三、存在问题；四、下一步计划。' },
      ],
    },
  ],
};

function sseBody(text, reasoning) {
  const frames = [];
  if (reasoning) {
    for (let i = 0; i < reasoning.length; i += 40) {
      frames.push({ choices: [{ index: 0, delta: { reasoning_content: reasoning.slice(i, i + 40) } }] });
    }
  }
  for (let i = 0; i < text.length; i += 60) {
    frames.push({ choices: [{ index: 0, delta: { content: text.slice(i, i + 60) } }] });
  }
  const chunks = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`);
  chunks.push(
    `data: ${JSON.stringify({
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1284, completion_tokens: 642, total_tokens: 1926 },
    })}\n\n`,
  );
  chunks.push('data: [DONE]\n\n');
  return chunks.join('');
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = path.join(ROOT, urlPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(ROOT, 'index.html');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startStaticServer();
  // 本机自带的 Chromium 可复用：CHROMIUM_PATH=/usr/bin/chromium node scripts/screenshots.mjs
  const launchOptions = { args: ['--no-sandbox', '--force-color-profile=srgb'] };
  if (process.env.CHROMIUM_PATH) launchOptions.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: 2,
    locale: 'zh-CN',
  });

  const page = await context.newPage();

  await page.route('**://api.deepseek.com/**', async (route) => {
    const request = route.request();
    if (request.url().includes('/user/balance')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BALANCE) });
      return;
    }
    let body = {};
    try {
      body = JSON.parse(request.postData() || '{}');
    } catch {
      body = {};
    }
    const reasoning = body.model === 'deepseek-reasoner' ? REASONING : undefined;
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody(ANSWER, reasoning),
    });
  });

  const shot = async (name) => {
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('saved', name);
  };

  const send = async (text) => {
    await page.fill('textarea[placeholder="给 DeepSeek 发送消息"]', text);
    await page.click('button[title="发送"]');
    await page.waitForSelector('button[title="发送"]', { timeout: 30000 });
    await page.waitForTimeout(500);
  };

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=登录 DeepSeek API 版', { timeout: 20000 });
  await shot('01-login');

  await page.fill('input[placeholder*="sk-..."]', 'sk-demo-0000000000000000000000000000');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForSelector('text=开启新对话', { timeout: 20000 });
  await page.waitForTimeout(900);
  await shot('02-welcome');

  await send('WSL2 环境下怎么把 DeepSeek 客户端跑起来？');
  await page.waitForTimeout(1200);
  await shot('03-chat');

  for (const question of [
    '帮我写一份工程量清单编制说明',
    '朗肯土压力理论的计算步骤',
    '把这份毕业设计摘要润色一下',
    '四川省定额里挖一般土方怎么套',
  ]) {
    await page.click('text=开启新对话');
    await page.waitForTimeout(500);
    await send(question);
  }

  await page.locator('aside button:has-text("WSL2")').first().click();
  await page.waitForTimeout(600);

  await page.click('button[title="设置"]');
  await page.waitForTimeout(400);
  await page.locator('.fixed.inset-0.z-40 button:has-text("模型")').first().click();
  await page.waitForTimeout(300);
  await page.click('text=DeepSeek-R1');
  await page.locator('.fixed.inset-0.z-40 .flex.h-14 button').first().click();
  await page.waitForTimeout(500);

  await send('为什么浏览器访问不到 5180 端口？');
  await page.waitForTimeout(1200);
  await page.click('text=已深度思考');
  await page.waitForTimeout(400);
  await shot('04-thinking');

  const samplePath = path.join('docs', 'screenshots', '.sample-export.json');
  fs.writeFileSync(samplePath, JSON.stringify(SAMPLE_EXPORT, null, 2));

  await page.click('text=导入官方数据');
  await page.waitForTimeout(400);

  // 链接导入：先切到「下载链接」页签截一张干净的空态，填一个演示链接（不发真实请求）
  await page.click('button:has-text("下载链接")');
  await page.waitForTimeout(300);
  await page.fill('input[placeholder^="粘贴官方数据导出"]', 'https://example.com/deepseek-export-2026-11.zip');
  await shot('11-import-link');

  // 再切回「本地文件」，走真实解析并截预览态
  await page.click('button:has-text("本地文件")');
  await page.waitForTimeout(300);
  await page.setInputFiles('input[type="file"]', samplePath);
  await page.waitForSelector('text=已解析', { timeout: 10000 });
  await shot('05-import');

  await page.click('text=取消');
  await page.waitForTimeout(400);
  fs.rmSync(samplePath, { force: true });

  await page.click('button[title="设置"]');
  await page.waitForTimeout(500);
  await shot('06-settings-account');
  await page.locator('.fixed.inset-0.z-40 button:has-text("模型")').first().click();
  await page.waitForTimeout(400);
  await shot('07-settings-model');
  await page.locator('.fixed.inset-0.z-40 button:has-text("数据")').first().click();
  await page.waitForTimeout(400);
  await shot('08-settings-data');
  await page.locator('.fixed.inset-0.z-40 .flex.h-14 button').first().click();
  await page.waitForTimeout(500);

  await page.click('button[title="切换主题"]');
  await page.waitForTimeout(700);
  await shot('09-dark');
  await page.click('button[title="切换主题"]');
  await page.waitForTimeout(500);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  await shot('10-mobile-chat');

  // 移动端抽屉：确认主题 / 设置 / 关闭三个按钮各自独立、互不遮挡
  await page.click('button[aria-label="打开菜单"]');
  await page.waitForTimeout(500);
  await shot('12-mobile-drawer');

  await context.close();
  await browser.close();
  server.close();
  console.log('done');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
