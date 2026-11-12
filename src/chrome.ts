import { getIcon } from "obsidian";

export interface HeaderAction {
  icon: string;
  label: string;
  onClick: (ev: MouseEvent) => void;
}

/**
 * Register an action button in a viewer header bar. Shared by inline embeds
 * and the tab view so new chrome features only ever hook in here.
 */
export function addHeaderAction(header: HTMLElement, action: HeaderAction): HTMLButtonElement {
  const btn = header.createEl("button", {
    cls: "clickable-icon",
    attr: { "aria-label": action.label },
  });
  const icon = getIcon(action.icon);
  if (icon) btn.appendChild(icon as unknown as HTMLElement);
  btn.addEventListener("click", (ev) => action.onClick(ev));
  return btn;
}
