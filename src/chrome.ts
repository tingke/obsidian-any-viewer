import { getIcon } from "obsidian";

export interface HeaderAction {
  icon: string;
  label: string;
  onClick: (ev: MouseEvent) => void;
}

/**
 * Register an action button in a viewer header bar. Shared by inline embeds
 * and the tab view so new chrome features only ever hook in here.
 *
 * The click handler stops propagation BEFORE invoking the callback: header
 * buttons sit inside embed spans, and Obsidian's own embed click handler
 * (registered on the same span earlier) would otherwise open the linked file
 * on top of the button's action. Target-phase stop beats any span-level
 * listener regardless of registration order.
 */
export function addHeaderAction(header: HTMLElement, action: HeaderAction): HTMLButtonElement {
  const btn = header.createEl("button", {
    cls: "clickable-icon",
    attr: { "aria-label": action.label },
  });
  const icon = getIcon(action.icon);
  if (icon) btn.appendChild(icon as unknown as HTMLElement);
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    action.onClick(ev);
  });
  return btn;
}
