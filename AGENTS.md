# AGENTS.md — AI 协作规则

> 本文件约束在本仓库工作的 AI 编码代理（Codex / Claude / Cursor 等）。
> 与代码冲突时以代码为准；与 promo/v0.5-tasks.md 冲突时以任务清单为准。

## 1. 产品边界（范围三原则，改动功能前必读）

1. **Obsidian 原生能嵌入的格式不接管**（图片/音视频/PDF/Markdown/Canvas，见 `src/util.ts` 的 `NATIVE_EXTS`）。任何新功能不得把原生格式引入 `kindForExt` 分派。原生格式的"周边增强"可以做，接管渲染不行。
2. **原生不能嵌入的格式都做，且嵌入与标签页双通道必须同时支持**——新增格式/语法时两条通道都要验证。
3. **语法两件套是本插件的差异化核心**：尺寸语法（`|W / xH / WxH`）+ 显示语法（`#page=N`、`#page=N~M`、`#Sheet`、`#Sheet!A1:D10`、`#5:20`、`#元素id`）。新语法必须先在 `src/fragment.ts` 落地并通过单测，再接渲染器。

## 2. 架构约定

- **渲染走渲染器类**：每种格式一个 `FileRenderer` 子类（`src/renderers.ts`，内含 `RenderKind` 与 `kindForExt` 派发），声明 `selfScrolling` / `needsBinary`，在 `REGISTRY` 注册。`embed.ts` 只保留通用管线（header、loading、错误卡片、徽标）——**不要在 `renderFileInto` 里加按 kind 的 if/else 分派**。
- **每格式一个模块**：`docx.ts` / `pptx.ts` / `sheet.ts` / `html.ts` 各自持有渲染实现与片段（pageRange/sheet/range/scrollToId）的落地逻辑；`fragment.ts` 是唯一的语法解析层。
- **Obsidian 平台规范**（eslint 强制）：禁止 `el.style.xxx =` 直接赋值（用 CSS 类或 `el.setCssProps()`）；定时器/raf 用 `window.requestAnimationFrame` 等 window 前缀形式（弹窗窗口兼容）。
- **隐藏 DOM 节点用 `any-viewer-hidden` 类**（`display:none !important`），不要移除节点——docx-preview/pptx-preview 内部持有索引。

## 3. 工程流程

- 交付前必须全绿：`npm run build && npm run lint && npm test`。
- 改过 `src/fragment.ts`（语法层）→ 必须跑 `npm test` 并为新语法补断言。
- 改过渲染层 → `npm run deploy` 部署到本地库实测（目标库可用 `ANY_VIEWER_VAULT=/path` 覆盖）。
- 依赖变更需说明理由；不引入新运行时依赖除非必要（现栈：docx-preview / exceljs / SheetJS / pptx-preview / jszip）。

## 4. 测试与 demo 资源耦合

- **`promo/demo-assets/` 的文件结构是手工用例的预期来源**（页数、sheet 名、行列范围）。改 `promo/make_demo_assets.py` → 必须同步更新 `promo/test-note-v0.5.md` 的用例预期 → 重新生成资源 → 部署插件 + 同步资源 + 重装测试笔记，三者一起交付。
- `活动页.html` 里的 `id="hero"` / `id="cta"` 是 html 锚点测试的前提，手工编辑与脚本生成要保持一致。
- 单元测试入口：`npm test`（`scripts/fragment.test.mjs`，esbuild 现场打包 fragment.ts 后断言）。

## 5. 文档同步

- 语法变更必须同步三处：`README.md`、`README.zh.md` 的语法表、`promo/test-note-v0.5.md` 的用例——三者不一致视为未完成。
- 面向用户的说明文档与提交信息：中文；代码注释：英文（与现有代码一致）。

## 6. 已知决策（不要反复推翻）

- 不做表格编辑/仪表盘（Sheet Plus 付费壁垒）、不做 PDF 编辑、不做格式广度战（竞品分析见 `promo/competitor-analysis.md`）。
- 片段必须写在 `|` 之前（Obsidian 文法决定），`|300#page=2` 这类写法解析失败回退默认是**预期行为**，不要"修复"它。
- 渲染保真度低于 WASM 方案是接受的取舍（轻量、纯前端、移动端可行），保真类需求先记录到路线图不硬刚。
- 链接解析有 basename 兜底（`util.ts` 的 `resolveByBasename`）：metadataCache 解析不到时按文件名遍历 vault（同目录优先、最短路径次之）。这是功能不是补丁——让"检测所有文件扩展名"关闭时卡片与预览照常工作，**不要移除**；真正的坏链（vault 内无此文件）仍交给 Obsidian 的未解析芯片。
- **两种片段语义并存，不要合并**：嵌入（`RenderIntoOptions.frag`）= 裁剪显示（xlsx 片段同时隐藏工作表标签栏）；标签页（`RenderIntoOptions.locate`）= 完整文件 + 渲染后自动定位到片段位置（`FileRenderer.locate` 钩子）。嵌入点"在标签页打开"即切换到 locate 语义（`openFileWithFragment`）。

## 7. 上架（先发版，后送审）

官方送审门禁要求 manifest 版本对应的 GitHub Release **已经发布**——审评扫描的就是 Release 附件，所以顺序是：发版 → 网页送审 → 照意见修改 → 升版本号发新版本 → 重新送审。（2026-11-12 实测：未发 Release 时送审直接被拒 "No release matches your manifest version"。）

每次上架前必跑官方 lint（与社区目录自动审核同源，脚本移植自 bz-reader 的 `scripts/lint-obsidian.mjs`）：

```bash
npm run lint:obsidian
```

- 必须 **0 error / 0 warning**；退出码非 0 就停（error 直接卡审，warning 是审评意见高频来源）。
- 工具链装在仓库外 `~/Library/Caches/any-viewer-lint`（`ANY_VIEWER_LINT_HOME` 可覆盖），首次自动安装，不碰项目 `node_modules`，版本钉死不受 devDependencies 漂移影响。
- eslint 配置由脚本临时生成到仓库根（`.eslint-obsidian.tmp.config.mjs`，已 gitignore），跑完自删——刻意区别于仓库自带的 `eslint.config.mjs`，清理不会碰它。需要豁免某条规则时在脚本 `writeTempConfig()` 里集中记录并写明理由。
- 支持 `--fix` 自动修复。

### 送审段（只到推送为止）

1. `npm run lint:obsidian` → 0/0；
2. 补齐本版翻译：新增/改动文案 zh/en 双包写实，不留硬编码双语文案；
3. 三道门：`npm run build && npm run lint && npm test`（快速门禁可用 `npm run verify` = typecheck + 单测 + 官方 lint）；
4. 版本号三处同步：`manifest.json` / `package.json` / `versions.json`；
5. 合规自查：`manifest.json` 与 `package.json` 的 description 不出现 "Obsidian"；`README.md` / `README.zh.md` 披露付费与联网；
6. 提交并推送 main；
7. 打 tag 并推送：`git tag <版本> && git push origin <版本>`——tag 与 `manifest.version` 逐字相同、**不带 `v`**；
8. CI（`.github/workflows/release.yml`）自动构建、校验 tag = manifest.version、发布 Release（三件套 + 出处证明），**正文自动提取 CHANGELOG.md 对应版本小节**（CHANGELOG 缺小节则构建失败，强制文档同步）；`gh release view <版本>` 确认；
9. 到 community.obsidian.md 网页提交送审（此时门禁校验 Release 已存在）；
10. 审评不通过：照报错修改 → **升版本号**（如 0.5.1）→ 重复 1–8 发新版本 → 重新送审；审评通过即完成，无需额外操作。
