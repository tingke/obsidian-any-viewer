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
