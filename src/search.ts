import { getIcon } from "obsidian";
import type { Dict } from "./i18n";

/**
 * Tab-view in-document search (v0.6 M2): TreeWalker highlight + count + jump.
 * Scope decision (promo/v0.6-tasks.md T2.1): tabs only, embeds don't provide
 * a search bar. html files are excluded by the caller — their text lives
 * inside a same-origin iframe we don't walk.
 */

const HIT_CLASS = "any-viewer-search-hit";
const CURRENT_CLASS = "is-current";

/** Highlight every case-insensitive occurrence of `query` inside `root`. */
function highlightMatches(root: HTMLElement, query: string): HTMLElement[] {
  const needle = query.toLowerCase();
  if (!needle) return [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      // skip our own chrome, already-highlighted runs and clipped-away pages
      if (parent.closest("script, style, mark, .any-viewer-hidden")) return NodeFilter.FILTER_REJECT;
      const value = node.nodeValue ?? "";
      if (!value.trim() || !value.toLowerCase().includes(needle)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const hits: HTMLElement[] = [];
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const textNode of nodes) {
    const value = textNode.nodeValue ?? "";
    const frag = createFragment();
    let last = 0;
    let idx = value.toLowerCase().indexOf(needle);
    while (idx >= 0) {
      if (idx > last) frag.appendChild(document.createTextNode(value.slice(last, idx)));
      const mark = createEl("mark");
      mark.className = HIT_CLASS;
      mark.textContent = value.slice(idx, idx + needle.length);
      frag.appendChild(mark);
      hits.push(mark);
      last = idx + needle.length;
      idx = value.toLowerCase().indexOf(needle, last);
    }
    if (last < value.length) frag.appendChild(document.createTextNode(value.slice(last)));
    textNode.parentNode?.replaceChild(frag, textNode);
  }
  return hits;
}

/** Unwrap every highlight under `root` and normalize the text nodes back. */
function clearMatches(root: HTMLElement): void {
  root.querySelectorAll(`mark.${HIT_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
    parent.normalize();
  });
}

export interface SearchBarController {
  el: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
}

/**
 * Build the search bar. `resolveRoot` is re-evaluated on every run — the stage
 * node is recreated on each re-render, so closures over it would go stale.
 */
export function createSearchBar(resolveRoot: () => HTMLElement | null, T: Dict): SearchBarController {
  let open = false;
  let marks: HTMLElement[] = [];
  let current = -1;
  let debounce = 0;

  const el = createDiv({ cls: "any-viewer-search-bar any-viewer-hidden" });
  // mirror Obsidian's native editor search: magnifier icon inside the field,
  // arrow navigation + close outside (2026-11-19 验收反馈)
  const field = el.createDiv({ cls: "any-viewer-search-field" });
  const fieldIcon = getIcon("search");
  if (fieldIcon) field.appendChild(fieldIcon);
  const input = field.createEl("input", {
    cls: "any-viewer-search-input",
    attr: { type: "text", spellcheck: false, placeholder: T.searchPlaceholder, "aria-label": T.searchPlaceholder },
  });
  const count = el.createSpan({ cls: "any-viewer-search-count" });
  const prevBtn = el.createEl("button", { cls: "clickable-icon", attr: { "aria-label": T.searchPrev } });
  prevBtn.appendChild(getIcon("arrow-up") as unknown as HTMLElement);
  const nextBtn = el.createEl("button", { cls: "clickable-icon", attr: { "aria-label": T.searchNext } });
  nextBtn.appendChild(getIcon("arrow-down") as unknown as HTMLElement);
  const closeBtn = el.createEl("button", { cls: "clickable-icon", attr: { "aria-label": T.searchClose } });
  closeBtn.appendChild(getIcon("x") as unknown as HTMLElement);

  const updateCount = () => {
    // native-style: stay silent until there is a query
    count.setText(!marks.length && !input.value.trim() ? "" : marks.length ? `${current + 1} / ${marks.length}` : "0 / 0");
  };

  const setCurrent = (index: number) => {
    marks[current]?.removeClass(CURRENT_CLASS);
    current = index;
    if (current < 0 || !marks.length) {
      updateCount();
      return;
    }
    const mark = marks[current];
    mark.addClass(CURRENT_CLASS);
    mark.scrollIntoView({ block: "center" });
    updateCount();
  };

  const run = () => {
    const root = resolveRoot();
    if (marks.length) {
      const oldRoot = marks[0].closest(".any-viewer-stage");
      if (oldRoot) clearMatches(oldRoot as HTMLElement);
      marks = [];
    }
    const query = input.value.trim();
    if (!root || !query) {
      setCurrent(-1);
      return;
    }
    marks = highlightMatches(root, query);
    setCurrent(marks.length ? 0 : -1);
  };

  const navigate = (dir: 1 | -1) => {
    if (!marks.length) return;
    setCurrent((current + dir + marks.length) % marks.length);
  };

  input.addEventListener("input", () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(run, 200);
  });
  input.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      navigate(ev.shiftKey ? -1 : 1);
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      closeBar();
    }
  });
  prevBtn.addEventListener("click", () => navigate(-1));
  nextBtn.addEventListener("click", () => navigate(1));
  // NB: call closeBar() — an unqualified close() here would resolve to
  // window.close() and take down the whole app (the "crash on close click").
  closeBtn.addEventListener("click", () => closeBar());

  function openBar(): void {
    if (open) {
      input.focus();
      input.select();
      return;
    }
    open = true;
    el.removeClass("any-viewer-hidden");
    input.focus();
    if (input.value) run();
  }

  function closeBar(): void {
    if (!open) return;
    open = false;
    window.clearTimeout(debounce);
    const root = resolveRoot();
    if (root) clearMatches(root);
    marks = [];
    current = -1;
    el.addClass("any-viewer-hidden");
  }

  return {
    el,
    open: openBar,
    close: closeBar,
    isOpen: () => open,
  };
}
