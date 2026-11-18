# 安卓 APK 安装与打包

DeepSeek API 版用 **Capacitor 6** 把同一套前端封装成安卓 App：界面仍是 WebView 里的 React 应用，但装到手机上是一个独立图标的应用，不依赖浏览器。

## 拿到 APK

仓库的 Actions 会为每次前端变更构建 APK，产物发布在 Releases（tag：`android-latest`）。也可在本地打包。

## 安装步骤

1. 下载 `DeepSeek-API-Client-*.apk` 传到手机（微信/QQ 传文件、USB、网盘均可）
2. 点击安装，系统弹「禁止安装未知来源应用」时选择允许
3. 桌面出现「DeepSeek API 版」图标
4. 打开后粘贴 API Key（或点「在 App 内登录官方账号」）登录

> 调试签名版本可安装但不可上架应用商店；正式发布请用自己的 keystore 重签。

## App 内登录（原生插件）

安卓包比网页版多一个能力：登录页可以点「在 App 内登录官方账号」。

- 实现：`native/android/WebLoginPlugin.java`，由 `scripts/android-patch.mjs` 幂等注入到 `android/app/src/main/java/<包名>/`，并在 `MainActivity.onCreate()` 里 `registerPlugin`。
- 行为：弹出 Dialog + WebView 加载 `https://chat.deepseek.com/sign_in`，登录完成后从页面 `localStorage` 读取 `userToken` 回传给前端；前端走与手工粘贴完全相同的校验与加密落库流程。
- 安全边界：插件不读取、不提交账号密码；地址写死为官方域名；用户可按返回键取消（返回 `cancelled`，不写任何状态）。
- 限制：官方若调整登录页的存储方式（不再写 `userToken`），插件会取不到令牌，此时退化为手工粘贴。

## 本地打包

环境：JDK 17、Android SDK（platform 34 + build-tools 34），Node 18+。

```bash
npm install
npx cap add android              # 首次生成 android/（该目录不入库）
npx playwright install chromium
npm run build
npx cap sync android
node scripts/android-patch.mjs   # 注入 App 内登录插件（WebLoginPlugin + MainActivity）
node scripts/android-icons.mjs   # 生成各密度启动图标
cd android && ./gradlew assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`。

只需改前端时，用快捷命令：

```bash
npm run android:sync   # build + cap sync
npm run android:patch  # 注入原生登录插件（首次或改插件后）
npm run android:icons  # 重生成图标（改了 SVG 才需要）
npm run android:apk    # 一步到 APK（sync + patch + icons + gradle）
```

> CI 里没有 Gradle Wrapper（仓库不提交二进制 jar），因此工作流用 runner 上的 `gradle` 命令打包，版本固定 8.2.1 以匹配 AGP 8.2。本地若有 wrapper 可照常用 `./gradlew`。

## 签名

在 `android/app/build.gradle` 的 `signingConfigs` 中配置自己的 keystore：

```gradle
android {
  signingConfigs {
    release {
      storeFile file(System.getenv("KEYSTORE"))
      storePassword System.getenv("STORE_PASS")
      keyAlias System.getenv("KEY_ALIAS")
      keyPassword System.getenv("KEY_PASS")
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
      minifyEnabled false
    }
  }
}
```

然后 `cd android && ./gradlew assembleRelease`，产物在 `android/app/build/outputs/apk/release/`。

## 与网页版的差异

- 同一套代码，同一套数据模型；差别只在宿主（WebView 替代浏览器）
- 会话与凭证存在 App 自己的 IndexedDB，与浏览器数据互不影响
- origin 是 `https://localhost`，官方接口回显该 Origin，因此无需代理；若企业网络拦截，可在设置里改接口地址
- 多一个原生能力：App 内登录（WebLoginPlugin），网页端自动隐藏该入口
- 卸载会连带删除本地会话，请先「导出全部会话」备份

## 已知限制

- 未接入原生文件选择器，导入导出走浏览器文件 API（WebView 支持，体验与 Chrome 一致）
- 链接导入受登录 cookie 影响：需要登录态的导出链接在 App 内同样可能被拦，提示后改用本地文件
- 不含后台流式：App 退到后台时请求会被系统挂起，回来需重新发送
- 未做 Android 分享/相机插件；后续如需图片问答要加 `@capacitor/camera`
