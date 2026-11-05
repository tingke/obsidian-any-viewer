# 上架 Obsidian 社区插件市场指南（2026 新流程）

> 官方指南：https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin
>
> ⚠️ **流程已改版**：obsidianmd/obsidian-releases 已**关闭插件上架 PR**（仓库设置了禁止开 PR），新流程改为在 [community.obsidian.md](https://community.obsidian.md) 社区目录网站上自助提交，自动审核。

---

## 0. 前置条件（本仓库已全部满足 ✅）

| 要求 | 状态 |
|---|---|
| 仓库公开（public） | ✅ https://github.com/tingke/obsidian-any-viewer |
| `README.md`（英文，市场详情页直接展示） | ✅ |
| `LICENSE`（MIT） | ✅ |
| `manifest.json`（id 全局唯一、不含 "obsidian" 字样、语义化版本 x.y.z） | ✅ id=any-viewer, version=0.3.0 |
| GitHub Release 附带 `main.js` + `manifest.json` + `styles.css`，tag 与 manifest version 一致 | ✅ 0.3.0（CI 自动发布） |
| `versions.json` 登记版本 → 最低 Obsidian 版本 | ✅ |
| `main.js` 入库供人工审核查看 | ✅ |

## 1. 发新版本（每个版本都要做）

```bash
# 改 manifest.json / package.json / versions.json 三处版本号后：
git add -A && git commit -m "release: x.y.z"
git tag x.y.z && git push origin main --tags
# CI 自动构建并发布 Release
```

## 2. 上架提交（三步，约 5 分钟）

1. 打开 **https://community.obsidian.md** ，用 **Obsidian 账号**登录（就是论坛账号；没有就现场注册一个）
2. 进入个人设置，**绑定 GitHub 账号**（网站用它验证你拥有 tingke/obsidian-any-viewer 这个仓库）
3. 点击 **Add a plugin or theme** → 填写仓库名 `tingke/obsidian-any-viewer` → 提交

## 3. 自动审核 + 发布

- 提交后目录网站会**自动审核**，页面上直接显示需要修正的问题（比旧的人工 PR 审核快得多）
- 有问题就改仓库 → 发新版本（第 1 步）→ 目录自动重新检查
- 无错误后在网站上选 **Publish**，插件即出现在 Obsidian 内置插件市场和官方目录
- **之后更新不需要再提交**：打新 tag 发 Release，几分钟内自动索引

## 4. 过审后推荐动作（可选）

- 论坛 [Share & showcase](https://forum.obsidian.md/c/share-showcase/9) 发帖官宣
- Discord `#updates` 频道公告（需要 developer 角色）

## 5. 常见审核问题

| 检查项 | 本插件情况 |
|---|---|
| id 不含 "obsidian" | ✅ any-viewer |
| 无远程代码执行 / eval | ✅ 无 |
| 无遥测、无网络请求 | ✅ 纯本地（HTML 内嵌的相对资源按需加载属于文件本身） |
| innerHTML 使用 | sheet.ts 的 SheetJS 兜底路径使用 DOMParser 解析（非 innerHTML 注入），内容来自用户本地文件 |
| 依赖版本健康 | docx-preview / exceljs / SheetJS / pptx-preview，MIT/BSD/Apache 协议 |

---

**历史备注**：仓库 `tingke/obsidian-releases` 是早期为旧流程（提 PR）创建的 fork，新流程不再需要，可保留或删除（`gh repo delete tingke/obsidian-releases`，需 delete_repo scope）。
