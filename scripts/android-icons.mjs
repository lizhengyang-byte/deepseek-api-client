/**
 * 生成 Android 启动图标：把 assets/android 下的 SVG 按各密度渲染成 mipmap PNG。
 * 需要在 `npx cap add android` 之后运行：node scripts/android-icons.mjs
 * 依赖：playwright（与截图脚本共用；本机可用 CHROMIUM_PATH 指定自有 Chromium）
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const RES = 'android/app/src/main/res';
const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

const ICON = fs.readFileSync('assets/android/icon.svg', 'utf8');
const GLYPH = fs.readFileSync('assets/android/glyph.svg', 'utf8');

const page = (svg, size) =>
  `<!doctype html><html><body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;width:100vw;height:100vh">${svg.replace(
    '<svg ',
    `<svg width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" `,
  )}</body></html>`;

async function main() {
  if (!fs.existsSync(RES)) {
    console.error('未找到 android 工程，请先执行 npx cap add android');
    process.exit(1);
  }

  const launchOptions = { args: ['--no-sandbox'] };
  if (process.env.CHROMIUM_PATH) launchOptions.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launchOptions);

  for (const [density, scale] of DENSITIES) {
    const dir = path.join(RES, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });

    const legacy = Math.round(48 * scale);
    const foreground = Math.round(108 * scale);
    const glyph = Math.round(foreground * 0.52);

    const render = async (html, size, out) => {
      const p = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await p.setContent(html);
      await p.screenshot({ path: out, omitBackground: true });
      await p.close();
    };

    await render(page(ICON, legacy), legacy, path.join(dir, 'ic_launcher.png'));
    fs.copyFileSync(path.join(dir, 'ic_launcher.png'), path.join(dir, 'ic_launcher_round.png'));
    await render(page(GLYPH, glyph), foreground, path.join(dir, 'ic_launcher_foreground.png'));
  }

  fs.writeFileSync(
    path.join(RES, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#4D6BFE</color>\n</resources>\n`,
  );

  await browser.close();
  console.log('图标已生成到', RES);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
