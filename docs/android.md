# 安卓 APK 安装与打包

DeepSeek API 版用 **Capacitor 6** 把同一套前端封装成安卓 App：界面仍是 WebView 里的 React 应用，但装到手机上是一个独立图标的应用，不依赖浏览器。

## 拿到 APK

仓库的 Actions 会为每次前端变更构建 APK，产物发布在 Releases（tag：`android-latest`）。也可在本地打包。

## 安装步骤

1. 下载 `DeepSeek-API-Client-*.apk` 传到手机（微信/QQ 传文件、USB、网盘均可）
2. 点击安装，系统弹「禁止安装未知来源应用」时选择允许
3. 桌面出现「DeepSeek API 版」图标
4. 打开后粘贴 API Key 登录

> 调试签名版本可安装但不可上架应用商店；正式发布请用自己的 keystore 重签。

## 本地打包

环境：JDK 17、Android SDK（platform 34 + build-tools 34），Node 18+。

```bash
npm install
npx cap add android          # 首次生成 android/（该目录不入库）
npx playwright install chromium
npm run build
npx cap sync android
node scripts/android-icons.mjs   # 生成各密度启动图标
cd android && ./gradlew assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`。

只需改前端时，用快捷命令：

```bash
npm run android:sync   # build + cap sync
npm run android:icons  # 重生成图标（改了 SVG 才需要）
npm run android:apk    # 一步到 APK
```

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
- 会话与密钥存在 App 自己的 IndexedDB，与浏览器数据互不影响
- origin 是 `https://localhost`，官方接口回显该 Origin，因此无需代理；若企业网络拦截，可在设置里改接口地址
- 卸载会连带删除本地会话，请先「导出全部会话」备份

## 已知限制

- 未接入原生文件选择器，导入导出走浏览器文件 API（WebView 支持，体验与 Chrome 一致）
- 不含后台流式：App 退到后台时请求会被系统挂起，回来需重新发送
- 未做 Android 分享/相机插件；后续如需图片问答要加 `@capacitor/camera`
