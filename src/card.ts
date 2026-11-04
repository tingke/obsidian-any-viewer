import { TFile, getIcon } from "obsidian";
import AnyViewerPlugin from "./main";
import { formatSize, iconEl, openFileExternally, revealFileInSystem } from "./util";
import { t } from "./i18n";

/** Build a file card for types we cannot render inline. */
export function buildFileCard(plugin: AnyViewerPlugin, file: TFile, opts?: { onOpenExternally?: () => void }): HTMLElement {
  const T = t(plugin.settings);
  const card = createDiv({ cls: "any-viewer-card" });
  card.setAttribute("title", T.cardTooltip(file.path));

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
    attr: { "aria-label": T.cardOpenLabel },
  });
  const icon = getIcon("external-link");
  if (icon) openBtn.appendChild(icon as unknown as HTMLElement);

  openBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openFileExternally(plugin, file);
    opts?.onOpenExternally?.();
  });

  card.addEventListener("click", (e) => {
    if ((e as MouseEvent).shiftKey) revealFileInSystem(plugin, file);
    else openFileExternally(plugin, file);
  });

  return card;
}
