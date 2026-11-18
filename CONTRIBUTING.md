# 贡献指南

感谢你愿意花时间改进这个项目。

## 提交 Issue

- **Bug**：说明系统与浏览器版本、复现步骤、期望结果、实际结果；涉及导入失败时，请附脱敏后的最小样例结构（不要贴真实对话内容）。
- **功能建议**：先说清使用场景与当前的不便，再说期望的交互，不必先写实现方案。

## 提交 PR

1. Fork 并新建分支：`feat/xxx`、`fix/xxx`、`docs/xxx`
2. 保持改动聚焦，一个 PR 只做一件事
3. 提交前本地跑通：

```bash
npm run typecheck
npm run test
npm run build
```

4. 提交信息用 Conventional Commits：`feat: 支持图片附件`、`fix: 修复 SSE 跨块断行`
5. PR 描述里写清「改了什么 / 为什么 / 怎么验证」

## 代码约定

- TypeScript 严格模式，领域逻辑不放 `any`
- 网络与存储调用只写在 `src/lib`，组件不做 IO
- 新增解析规则必须补 `tests/` 下的样例
- 不引入官方商标、图标、字体等受保护素材
- 不提交任何真实 API Key、userToken 或用户对话数据

## 安全

发现密钥泄露、XSS、依赖漏洞等问题，请不要开公开 Issue，直接联系维护者。
