import { FileView, TFile, getIcon, WorkspaceLeaf } from "obsidian";
import AnyViewerPlugin from "./main";
import { renderFileInto } from "./embed";
import { t } from "./i18n";
import type { ParsedFragment } from "./fragment";
import type { ReadingPosition } from "./positions";
import { getRenderer, kindForExt, RenderKind } from "./renderers";
import { createSearchBar, type SearchBarController } from "./search";
import { ANY_VIEW_TYPE, openFileExternally } from "./util";

// View type id lives in util.ts (shared with openFileWithFragment there);
// re-exported for the existing import sites.
export { ANY_VIEW_TYPE };

/** Full-pane view for office/html files opened from the file explorer. */
export class AnyViewerFileView extends FileView {
  private plugin: AnyViewerPlugin;
  private currentRender = 0;
  /** Locate hint from an embed's "open in tab": full render, then jump here. */
  private pendingLocate?: ParsedFragment;
  /** In-document search (v0.6 M2) — recreated on every render. */
  private search?: SearchBarController;
  /** HTML tab view mode (v0.6 T3.1) — session-scoped, embeds always start reading. */
  private htmlSourceMode = false;
  /** Pane action-bar toggle for the html view mode (added lazily, icon synced per render). */
  private htmlAction?: HTMLElement;
  /** Pane action-bar buttons whose tooltips follow the selected UI language. */
  private actSystemApp?: HTMLElement;
  private actReload?: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: AnyViewerPlugin) {
    super(leaf);
    this.plugin = plugin;

    // addAction titles are set once per pane; localized strings are re-synced
    // in render() so a UI language switch updates them instantly.
    this.actSystemApp = this.addAction("external-link", t(this.plugin.settings).openWithSystemApp, () => {
      if (this.file) openFileExternally(this.plugin, this.file);
    });
    this.actReload = this.addAction("refresh-cw", t(this.plugin.settings).reload, () => {
      if (this.file) void this.render(this.file);
    });

    // Mod/Cmd+F opens, Esc closes the in-document search bar. Mod+F lives on
    // a window listener rather than a default command hotkey (the official
    // review forbids shipping default hotkeys); the command registered in
    // main.ts stays rebindable and opens the same bar. Both paths are
    // idempotent. All handled on window so it works wherever focus sits.
    this.registerDomEvent(window, "keydown", (ev: KeyboardEvent) => {
      if (this.app.workspace.getActiveViewOfType(AnyViewerFileView) !== this) return;
      if (ev.key === "Escape" && this.search?.isOpen()) {
        // the input's own Esc handler already closed it when focus was inside;
        // this branch covers Esc from anywhere else in the view
        ev.preventDefault();
        this.search.close();
        return;
      }
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "f" && this.search) {
        ev.preventDefault();
        this.search.open();
      }
    });
  }

  /** Whether the in-document search bar exists for the current file. */
  hasSearch(): boolean {
    return !!this.search;
  }

  /** Open the in-document search bar (command entry point). */
  openSearch(): void {
    this.search?.open();
  }

  getViewType(): string {
    return ANY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file ? this.file.basename : "Any Viewer";
  }

  getIcon(): string {
    return "paperclip";
  }

  async onLoadFile(file: TFile): Promise<void> {
    // A fresh openFile (explorer click, link click…) starts unlocated;
    // openFileWithFragment re-applies its hint right after via applyFragment().
    this.pendingLocate = undefined;
    await this.render(file);
  }

  /** Re-render the current file (e.g. right after the UI language changes). */
  rerender(): void {
    if (this.file) void this.render(this.file);
  }

  /**
   * Re-render with a locate hint (see openFileWithFragment): full file, then
   * scroll/activate the fragment position. Resets when a different file opens
   * (onLoadFile), so language switches and reloads keep the same position.
   */
  applyFragment(frag?: ParsedFragment): void {
    if (!frag) return;
    this.pendingLocate = frag;
    if (this.file) void this.render(this.file);
  }

  private async render(file: TFile): Promise<void> {
    const token = ++this.currentRender;
    const s = this.plugin.settings;

    // pane actions persist across re-renders — re-sync their tooltips so a UI
    // language switch updates them instantly (htmlAction already does this)
    const paneT = t(s);
    this.actSystemApp?.setAttribute("aria-label", paneT.openWithSystemApp);
    this.actReload?.setAttribute("aria-label", paneT.reload);

    const ext = (file.extension ?? "").toLowerCase();
    const kind: RenderKind =
      kindForExt(ext, {
        docx: s.enableDocx,
        sheet: s.enableSheet,
        pptx: s.enablePptx,
        html: s.enableHtml,
        card: s.enableFallbackCard,
      }) ?? "card";

    this.contentEl.empty();
    this.contentEl.addClass("any-viewer-view");

    // In-document search (v0.6 M2): tabs of docx/sheet/pptx only — html text
    // lives inside its iframe and card kinds have nothing to search.
    const searchSupported = kind === "docx" || kind === "sheet" || kind === "pptx";
    this.search = searchSupported
      ? createSearchBar(() => this.contentEl.querySelector<HTMLElement>(".any-viewer-stage"), t(this.plugin.settings))
      : undefined;
    if (this.search) this.contentEl.appendChild(this.search.el);

    // HTML tab: source/reading toggle lives in the pane action bar (top-right,
    // next to "open with system app" — no header since M4). Added lazily once
    // per pane; the icon/label re-sync on every render (2026-11-19 revision).
    if (kind === "html") {
      const T = t(s);
      this.htmlAction ??= this.addAction("code", T.viewSource, () => {
        this.htmlSourceMode = !this.htmlSourceMode;
        if (this.file) void this.render(this.file);
      });
      const icon = getIcon(this.htmlSourceMode ? "book-open" : "code");
      if (icon) this.htmlAction.replaceChildren(icon);
      this.htmlAction.setAttribute("aria-label", this.htmlSourceMode ? T.viewReading : T.viewSource);
    }
    // the action persists on the pane — hide it while a non-html file shows
    this.htmlAction?.toggleClass("any-viewer-hidden", kind !== "html");

    const body = this.contentEl.createDiv({ cls: "any-viewer-view-body" });
    const frame = body.createDiv({ cls: "any-viewer-view-frame" });

    // pptx & html need a laid-out pane height; wait one frame before measuring
    if (kind === "pptx" || kind === "html") {
      await new Promise((r) => window.requestAnimationFrame(() => r(null)));
      if (token !== this.currentRender) return;
    }

    // Memory adjudication (promo/v0.6-tasks.md M0): the remembered worksheet
    // only applies when no explicit fragment hint exists — locate wins.
    const mem = this.pendingLocate ? undefined : this.plugin.readingPositions.get(file.path);

    await renderFileInto(this.plugin, frame, file, kind, {
      locate: this.pendingLocate,
      direct: true,
      memorySheet: kind === "sheet" ? mem?.sheet : undefined,
      htmlSource: kind === "html" ? this.htmlSourceMode : undefined,
      pptxWidth: Math.max(480, Math.min(1080, this.contentEl.clientWidth || 900)),
      pptxHeight: Math.max(300, this.contentEl.clientHeight - 40 || 500),
      heightHint: kind === "html" ? Math.max(300, this.contentEl.clientHeight - 40 || 500) : undefined,
      maxHeight: undefined,
      // Tab views render content only (v0.6 M4 revision): no header bar —
      // the pane action bar already carries "open with system app" / reload.
      showHeader: false,
      allowScripts: s.htmlAllowScripts,
    });
    // pptx keeps its own internal scrolling — "fills" would stack a second
    // scrollbar on top of the viewer's own one in the tab view.
    const stage = frame.querySelector<HTMLElement>(".any-viewer-stage");
    if (stage && !stage.classList.contains("no-scroll")) stage.classList.add("fills");
    if (!stage || kind === "card") return;

    // Reading-position memory — TAB channel only (embeds never participate).
    if (!this.pendingLocate) this.restoreReadingPosition(kind, stage, mem);
    this.trackReadingPosition(kind, stage, file);
    // Sidebar outline (v0.6 M1) — docx headings; other kinds have no hook.
    this.renderOutlinePanel(kind, stage);
  }

  /** Build the docx outline sidebar; no-op for kinds without a hook/entries. */
  private renderOutlinePanel(kind: RenderKind, stage: HTMLElement): void {
    const renderer = getRenderer(kind);
    if (!renderer.buildOutline) return;
    const entries = renderer.buildOutline(stage);
    if (!entries.length) return;
    const body = this.contentEl.querySelector<HTMLElement>(".any-viewer-view-body");
    if (!body) return;
    body.addClass("has-outline");

    const T = t(this.plugin.settings);
    const aside = body.createDiv({ cls: "any-viewer-outline" });
    body.insertBefore(aside, body.firstChild);
    const head = aside.createDiv({ cls: "any-viewer-outline-head" });
    head.createSpan({ cls: "any-viewer-outline-title", text: T.outlineTitle });
    const toggle = head.createEl("button", {
      cls: "clickable-icon any-viewer-outline-toggle",
      attr: { "aria-label": T.outlineTitle },
    });
    toggle.appendChild(getIcon("chevrons-left") as unknown as HTMLElement);
    toggle.addEventListener("click", () => aside.toggleClass("is-collapsed", !aside.hasClass("is-collapsed")));

    const list = aside.createDiv({ cls: "any-viewer-outline-list" });
    for (const entry of entries) {
      // indent by heading level via classes (levels clamp to 1–9)
      const item = list.createDiv({ cls: `any-viewer-outline-item is-lvl-${Math.min(Math.max(entry.level, 1), 9)}` });
      item.createSpan({ cls: "any-viewer-outline-text", text: entry.text });
      if (entry.page) item.createSpan({ cls: "any-viewer-outline-page", text: String(entry.page) });
      item.addEventListener("click", () => {
        list.querySelectorAll(".is-active").forEach((el) => el.removeClass("is-active"));
        item.addClass("is-active");
        entry.target.scrollIntoView({ block: "start" });
      });
    }
  }

  /** Apply a remembered reading position (fragment-free tab open only). */
  private restoreReadingPosition(kind: RenderKind, stage: HTMLElement, mem: ReadingPosition | undefined): void {
    if (!mem || mem.scroll <= 0) return;
    const renderer = getRenderer(kind);
    if (renderer.restorePosition) {
      renderer.restorePosition(stage, mem);
      return;
    }
    const surface = renderer.scrollSurface ? renderer.scrollSurface(stage) : stage;
    if (surface) surface.scrollTop = mem.scroll;
  }

  /** Record the scroll position (debounced) + active worksheet while reading. */
  private trackReadingPosition(kind: RenderKind, stage: HTMLElement, file: TFile): void {
    const renderer = getRenderer(kind);
    const surface = renderer.scrollSurface ? renderer.scrollSurface(stage) : stage;
    // null = the kind scrolls somewhere memory cannot reach (html iframe).
    if (!surface) return;
    let timer: number | undefined;
    this.registerDomEvent(
      surface,
      "scroll",
      () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          this.plugin.noteReadingPosition(file.path, {
            scroll: surface.scrollTop,
            sheet: renderer.positionHint?.(stage)?.sheet,
          });
        }, 500);
      },
      { passive: true },
    );
  }
}
