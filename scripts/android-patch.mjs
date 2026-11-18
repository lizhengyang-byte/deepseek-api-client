/**
 * 把 native/android 下的 Java 源码装进 Capacitor 生成的 android 工程。
 * 用法：node scripts/android-patch.mjs
 * 幂等：多次执行结果一致，重复跑不会重复插入。
 */
import fs from 'node:fs';
import path from 'node:path';

const CONFIG = fs.readFileSync('capacitor.config.ts', 'utf8');
const APP_ID = (CONFIG.match(/appId:\s*'([^']+)'/) ?? [])[1];
if (!APP_ID) {
  console.error('capacitor.config.ts 里没有 appId');
  process.exit(1);
}

const PACKAGE_PATH = APP_ID.replace(/\./g, '/');
const JAVA_DIR = path.join('android', 'app', 'src', 'main', 'java', PACKAGE_PATH);
if (!fs.existsSync(path.join('android', 'app'))) {
  console.error('未找到 android 工程，请先执行 npx cap add android');
  process.exit(1);
}
fs.mkdirSync(JAVA_DIR, { recursive: true });

for (const file of ['WebLoginPlugin.java', 'MainActivity.java']) {
  const src = path.join('native', 'android', file);
  const dst = path.join(JAVA_DIR, file);
  fs.copyFileSync(src, dst);
  console.log('installed', dst);
}

console.log('Android 原生插件已就绪（App 内登录）');
