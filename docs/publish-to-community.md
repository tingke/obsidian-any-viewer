# 上架 Obsidian 社区插件市场指南

本插件（Any Viewer）从 GitHub 仓库到出现在 Obsidian 官方社区插件市场，完整流程如下。官方要求文档：<https://docs.obsidian.md/Reference/Plugin+guidelines/Publish+to+the+community+plugin+gallery>

---

## 0. 前置条件（硬性要求）

| 要求 | 说明 |
|---|---|
| 仓库公开 | 必须是 GitHub **public** 仓库 |
| 三个发布文件 | `manifest.json`、`main.js`、`styles.css`（styles.css 可选但建议保留） |
| Release 对应版本 | 每个插件版本都要有 GitHub Release，且 Release 上传的 `manifest.json` 中 `version` 必须与 Release tag 一致 |
| 版本登记 | `versions.json` 记录每个插件版本对应的最低 Obsidian 版本 |
| 不侵权、安全 | 遵守开发者政策：不收集用户数据、无远程代码执行、符合 MIT 等开源协议 |
| 人工审核 | Obsidian 团队会人工 review 代码（一般几天到几周） |

## 1. 准备仓库（一次性）

本仓库已具备（如有缺漏按下表补齐）：

- ✅ `manifest.json`（`id` 唯一、`description` 不得出现插件名以外的推广）
- ✅ `versions.json`
- ✅ `.github/workflows/release.yml`（push tag 自动构建并发布 Release）
- ⬜ **README.md 需英文**：市场直接展示仓库 README，建议中英双语（中文在上或英文在上均可，另一语言附后）
- ⬜ LICENSE 文件（MIT 全文，文件名全大写 `LICENSE`）
- ⬜ `.gitignore` 不忽略 `main.js`（**重要**：Obsidian 审核要求 main.js 入库，供审核员直接查看；当前 `.gitignore` 里应删除 `main.js` 这一行，改为只发 Release 亦可，但入库最省事）
- ⬜ （推荐）`README` 顶部加徽章与截图/演示 GIF，市场页更专业

### 1.1 把仓库设为公开

```bash
gh repo edit tingke/obsidian-any-viewer --visibility public
```

### 1.2 补齐 LICENSE 与 main.js 入库

```bash
curl -sL https://www.apache.org/licenses/LICENSE-2.0.txt -o /dev/null  # 仅示例
# MIT 全文写入 LICENSE（作者填你的名字）
```

## 2. 发布一个版本（每个版本都要做）

```bash
# 1) 改三处版本号
#    manifest.json 的 "version": "0.2.0"
#    package.json 的 "version"（习惯保持一致）
#    versions.json 增加 { "0.2.0": "1.5.0" }   ← 值 = minAppVersion
npm version 0.2.0 --no-git-tag-version   # 只改 package.json，manifest/versions 手动改

# 2) 提交并打 tag（tag 必须与 manifest.json 的 version 完全一致）
git add -A
git commit -m "release: 0.2.0"
git tag 0.2.0

# 3) 推送，CI 自动构建并发 Release
git push origin main --tags
```

CI 会自动：构建 → 校验 tag/manifest/versions 一致性 → 把 `main.js`、`manifest.json`、`styles.css` 传到 GitHub Release。

## 3. 提交上架申请

1. Fork 官方仓库：<https://github.com/obsidianmd/obsidian-releases>（页面右上角 Fork）
2. 编辑 fork 里的 **`community-plugins.json`**，在 JSON 数组末尾追加一条（注意前面一行末尾补逗号）：

   ```json
   {
     "id": "any-viewer",
     "name": "Any Viewer",
     "description": "Insert and preview any file type (Word/Excel/PowerPoint/HTML) in notes, with a file card fallback.",
     "author": "tingke",
     "repoUrl": "https://github.com/tingke/obsidian-any-viewer"
   }
   ```

   - `id` 必须与 `manifest.json` 的 `id` 一致
   - `description` 用英文，≤ 40 字符左右为佳（不要太长）
3. 新建 Pull Request 到 `obsidianmd/obsidian-releases` 的 `master` 分支
4. PR 标题建议：`Add Any Viewer (any-viewer)`

## 4. 审核阶段

- 提交后到插件审核队列，会有 Obsidian 团队成员回复（见 PR 评论）
- 常见审核意见与处理：
  - **要求加英文文档** → README 增加英文版
  - **安全**：不允许 `innerHTML` 直接注入未净化内容、不允许 eval/远程脚本；本插件表格渲染使用了 `innerHTML`（内容来自用户本地文件），若被指出，需改为 DOM API 构建或引入 sanitizer
  - **命名**：`name`/`description` 不得包含 "Obsidian" 字样以外的多余词，`id` 不得与其他插件重复
  - **versions.json 缺版本** → 每个 release 都要登记
- 按意见修改后**同一个 PR 里继续提交**（不要关闭重开），并**发布新的 patch 版本**（如 0.1.1）让审核者拉取
- 审核通过后 PR 被 merge，插件即上架；此后用户在 Obsidian 内“第三方插件-浏览”即可搜索安装

## 5. 后续版本更新

上架后的更新**不需要再提 PR**：

1. 正常改代码、更新 `manifest.json` 与 `versions.json`
2. `git tag <新版本> && git push origin main --tags`
3. CI 自动发 Release → Obsidian 会在几小时内索引到新版本并提示用户更新

## 6. 常见坑

| 坑 | 规避 |
|---|---|
| tag 与 manifest 版本不一致 | 已由 CI 校验步骤兜底 |
| 忘记把 `main.js` 加入 git / Release | CI 每次都上传三件套到 Release |
| `description` 太长或带营销词 | 英文、克制、≤ 40 字符 |
| 用 `innerHTML` 注入本地文件内容 | 审核可能要求净化；提前准备说明（内容来源是用户自己的文件） |
| 移动端兼容 | `manifest.json` 的 `isDesktopOnly: false` 时要保证移动端不崩（本插件已在调用 Electron 前做了平台判断） |

---

**当前状态清单**

- [x] CI/CD（tag → Release）
- [x] GitHub 仓库 `tingke/obsidian-any-viewer`
- [x] LICENSE 文件（MIT）
- [x] README 英文版（中英双语）
- [x] `.gitignore` 已移除 `main.js`（构建产物已入库，满足审核要求）
- [ ] 仓库公开（上架前执行 1.1：`gh repo edit tingke/obsidian-any-viewer --visibility public`）
- [ ] 提交 PR 到 obsidianmd/obsidian-releases（按第 3 节操作）
