import { App, TFile, getIcon } from "obsidian";
import { formatSize, iconEl, openFileExternally, revealFileInSystem } from "./util";

/** Build a file card for types we cannot render inline. */
export function buildFileCard(app: App, file: TFile, opts?: { onOpenExternally?: () => void }): HTMLElement {
  const card = createDiv({ cls: "any-viewer-card" });
  card.setAttribute(
    "title",
    `${file.path}\n单击：用系统应用打开 · Shift+单击：在文件管理器中显示`
  );

  const iconWrap = card.createDiv({ cls: "any-viewer-card-icon" });
  iconWrap.appendChild(iconEl(file.extension));

  const body = card.createDiv({ cls: "any-viewer-card-body" });
  body.createDiv({ cls: "any-viewer-card-name", text: file.name });
  body.createDiv({
    cls: "any-viewer-card-meta",
    text: `${(file.extension || "—").toUpperCase()} · ${formatSize(file.stat.size)}`,
  });

  const actions = card.createDiv({ cls: "any-viewer-card-actions" });
  const openBtn = actions.createEl("button", {
    cls: "any-viewer-card-btn clickable-icon",
    attr: { "aria-label": "用系统应用打开" },
  });
  const icon = getIcon("external-link");
  if (icon) openBtn.appendChild(icon);

  openBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openFileExternally(app, file);
    opts?.onOpenExternally?.();
  });

  card.addEventListener("click", (e) => {
    if ((e as MouseEvent).shiftKey) revealFileInSystem(app, file);
    else openFileExternally(app, file);
  });

  return card;
}
