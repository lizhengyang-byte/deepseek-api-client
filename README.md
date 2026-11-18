# DeepSeek API 版

> 非官方开源客户端。用官方账号登录，按 **API 用量**计费，支持把 **官方导出的数据**导入后**原地续聊**，界面手感与 DeepSeek 官方 App 保持一致。
>
> 本项目与 DeepSeek 官方无隶属关系，不使用官方商标与图形素材。请自行遵守官方服务条款。

<p align="left">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-4d6bfe" />
  <img alt="stack" src="https://img.shields.io/badge/React-18-4d6bfe" />
  <img alt="build" src="https://img.shields.io/badge/build-vite%205-4d6bfe" />
</p>

## 它解决什么问题

| 痛点 | 这个客户端的做法 |
| --- | --- |
| 官方网页/App 的会话导出来后只是一堆 JSON，看不了也接不上 | 拖入导出包，本地解析入库，历史消息直接变成可继续追问的会话 |
| 想用自己的 API 余额，但没有顺手的对话界面 | 官方 API 直连，流式回答，每条消息显示 token 与费用估算 |
| 想改造界面、做二次开发，没有可读的开源实现 | 纯前端单页应用，TypeScript 严格模式，MIT 许可 |

## 功能

- **两种登录通道**
  - `API Key`：在开放平台创建密钥，应用内校验并查询余额，走 API 计费（推荐）
  - `网页通道`（实验性）：粘贴官方网页的 `userToken`，按网页账号额度对话
- **流式对话**：SSE 增量渲染，支持停止生成、重新生成、删除消息
- **深度思考**：R1 的推理内容单独收集，「已深度思考」可展开查看，不与正文混淆
- **官方数据导入**：兼容 `mapping` 树、`messages` 数组、`chat_messages` 数组三种结构；支持 `.zip` 与 `.json`；按 id 幂等去重
- **续聊**：导入会话与原生会话同库同结构，可直接继续提问，历史按「回传轮数」参与上下文
- **本地优先**：会话、消息、用量全部存在 IndexedDB；密钥用 AES-GCM 加密存储，不上传任何服务器
- **计费透明**：每条回答显示输入/输出 tokens 与费用估算，单价可在设置中修改（默认值仅为示例）
- **界面还原**：品牌蓝、圆角输入容器、消息气泡、侧栏分组、移动端抽屉，明暗主题一键切换
- **数据可带走**：一键导出全部会话 JSON，可再次导入本应用

## 快速开始

```bash
git clone https://github.com/<your-name>/deepseek-api-client.git
cd deepseek-api-client
npm install
npm run dev      # http://localhost:5173
```

打包静态站点：

```bash
npm run build    # 产物在 dist/，可直接部署到任意静态托管
npm run preview  # 本地预览构建产物
```

## 登录

### 方式一：API Key（推荐）

1. 打开 <https://platform.deepseek.com/api_keys>，创建密钥（形如 `sk-xxx`）
2. 在登录页选择「API Key」，粘贴后点击「登录并校验密钥」
3. 校验通过会显示账户余额；密钥经 AES-GCM 加密后只存在本机

> 计费完全由官方 API 侧结算，本应用只做用量展示与估算。

### 方式二：官方网页令牌（实验性）

1. 在浏览器登录 <https://chat.deepseek.com>
2. `F12` → Application → Local Storage → `chat.deepseek.com` → 复制 `userToken` 的值
3. 登录页选择「官方网页登录」，粘贴并连接

该通道依赖官方网页端当前使用的非公开接口，随时可能调整；失败时会提示切回 API Key。

## 导入官方数据并续聊

1. 官方 App / 网页：设置 → 数据导出，下载压缩包（内含记录全部会话的 JSON）
2. 客户端左下角「导入官方数据」，把 `.zip` 或 `.json` 拖进去
3. 预览会显示解析到的会话数与消息数，确认后写入本地
4. 在会话列表里打开任意一条，直接在输入框继续提问

解析策略：不绑定文件名，按结构识别会话集合；`mapping` 树从叶子回溯成线性对话；重复导入同一 id 的会话不会产生副本，只会补齐更长的消息分支。

## 配置说明

设置页（侧栏齿轮）包含：

- **接入方式**：切换 API Key / 网页通道，查看密钥掩码与余额，刷新余额
- **模型**：DeepSeek-V3（`deepseek-chat`）/ DeepSeek-R1（`deepseek-reasoner`）
- **生成参数**：温度、最大输出 tokens、回传历史轮数、系统提示词
- **计费单价**：默认值仅为示例，请按官方最新价格填写
- **数据**：导入、导出全部会话、清空本地数据
- **接口地址**：默认 `https://api.deepseek.com`，可填自建反向代理

## 技术栈

React 18 · TypeScript 5 · Vite 5 · Tailwind CSS 3 · Zustand · Dexie（IndexedDB）· react-markdown + KaTeX + highlight.js · JSZip

## 目录结构

```
src/
  components/   界面：会话列表、对话区、输入框、登录、设置、导入
  store/        Zustand：auth / settings / chat
  lib/          传输（deepseek、web、sse）、存储（db、crypto）、导入、计费、导出
  types/        共享类型
  styles/       设计令牌与全局样式（含 Markdown 排版）
tests/          导入解析与 SSE 解码单测
docs/           技术设计文档、项目规划文档
```

## 开发与测试

```bash
npm run typecheck   # 类型检查
npm run test        # 单元测试（导入解析器、SSE 解码器）
npm run build       # 类型检查 + 生产构建
```

## 文档

- [技术设计文档](docs/technical-design.md)
- [项目规划文档](docs/project-plan.md)

## 已知边界

- 一期不含图片/文件问答、语音输入、多端云同步
- 网页通道不保证长期可用，主路径是 API Key
- 费用为估算，真实账单以官方控制台为准
- 浏览器清理站点数据会丢失本地会话，请定期导出备份

## Roadmap

- [ ] 附件与图片问答
- [ ] 提示词库与快捷键
- [ ] 可选自建同步服务（端到端加密）
- [ ] 模型适配器插件化

## License

[MIT](LICENSE)。Issue / PR 请先读 [CONTRIBUTING](CONTRIBUTING.md)。

---

## English

An **unofficial**, open-source desktop/mobile web client for DeepSeek:

- Sign in with your own **API key** (billed through the official API) or an experimental web-session token
- **Import** the official data export (`.zip` / `.json`) and **continue the conversation** where it stopped
- UI follows the official app's layout, spacing and interaction rhythm, rebuilt with an original icon set
- Everything stays local: IndexedDB for chats, AES-GCM encrypted key storage, zero backend

```bash
npm install && npm run dev
```

MIT licensed. Not affiliated with DeepSeek.
