import { TFile } from "obsidian";
import AnyViewerPlugin from "./main";
import { openFileExternally, revealFileInSystem } from "./util";
import { t } from "./i18n";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

/**
 * Animated "cannot preview inside Obsidian" artwork: a document page showing
 * the extension (abstract content lines for long names) with a padlock that
 * shakes periodically. Built with the DOM API (no innerHTML), themed through
 * CSS variables, animated by the stylesheet (honors prefers-reduced-motion).
 */
function createCardArt(ext: string): SVGElement {
  const svg = svgEl("svg", { class: "any-viewer-card-art", viewBox: "13 4 41 52", "aria-hidden": "true" });
  const label = ext.toUpperCase();
  const showText = label.length > 0 && label.length <= 5;

  const page = svgEl("g", { class: "art-page" });
  page.appendChild(
    svgEl("path", {
      d: "M18 6 h13 l10 10 v30 a3 3 0 0 1 -3 3 H18 a3 3 0 0 1 -3 -3 V9 a3 3 0 0 1 3 -3 z",
      fill: "var(--background-primary)",
      stroke: "var(--text-muted)",
      "stroke-width": "2.5",
      "stroke-linejoin": "round",
    })
  );
  page.appendChild(
    svgEl("path", {
      d: "M31 6 v7 a3 3 0 0 0 3 3 h7",
      fill: "none",
      stroke: "var(--text-muted)",
      "stroke-width": "2.5",
      "stroke-linecap": "round",
    })
  );
  if (showText) {
    const size = label.length <= 3 ? 10 : label.length === 4 ? 8.5 : 7;
    const text = svgEl("text", { x: "28", y: "31", "text-anchor": "middle", class: "art-ext", "font-size": String(size) });
    text.textContent = label;
    page.appendChild(text);
  } else {
    for (const y of [26, 32, 38]) {
      page.appendChild(svgEl("rect", { x: "20", y: String(y), width: "16", height: "2.5", rx: "1.25", class: "art-line" }));
    }
  }
  svg.appendChild(page);

  const lock = svgEl("g", { class: "art-lock" });
  lock.appendChild(
    svgEl("path", {
      d: "M39.5 41 v-4 a4 4 0 0 1 8 0 v4",
      fill: "none",
      stroke: "var(--interactive-accent)",
      "stroke-width": "2.5",
      "stroke-linecap": "round",
    })
  );
  lock.appendChild(svgEl("rect", { x: "35", y: "41", width: "17", height: "13", rx: "3", fill: "var(--interactive-accent)" }));
  lock.appendChild(svgEl("circle", { cx: "43.5", cy: "47.5", r: "1.8", fill: "var(--text-on-accent)" }));
  svg.appendChild(lock);
  return svg;
}

export interface UnavailableOptions {
  /** Show the filename as the first text line (standalone cards without a header). */
  showName?: boolean;
}

/**
 * Bare "unavailable" block for fragment-scopeless fallbacks: centered animated
 * artwork + one line of copy ("cannot open inside Obsidian"). The whole block
 * is clickable (system app); Shift+click reveals in the file manager. Without
 * a containing card box when the frame header already shows the filename and
 * actions.
 */
export function buildUnavailableContent(plugin: AnyViewerPlugin, file: TFile, opts?: UnavailableOptions): HTMLElement {
  const T = t(plugin.settings);
  const block = createDiv({ cls: "any-viewer-unavailable" });
  block.setAttribute("title", T.cardTooltip(file.path));
  block.setAttribute("role", "button");
  block.setAttribute("tabindex", "0");
  block.setAttribute("aria-label", `${file.name} — ${T.cardOpenLabel}`);

  block.appendChild(createCardArt(file.extension ?? ""));

  const text = block.createDiv({ cls: "any-viewer-unavailable-text" });
  if (opts?.showName) text.createDiv({ cls: "any-viewer-unavailable-name", text: file.name });
  text.createDiv({ cls: "any-viewer-unavailable-title", text: T.unavailableTitle });

  const open = (shiftKey = false) => {
    if (shiftKey) revealFileInSystem(plugin, file);
    else openFileExternally(plugin, file);
  };
  block.addEventListener("click", (e) => open((e as MouseEvent).shiftKey));
  block.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    open();
  });
  return block;
}

/**
 * Fallback for embeds of types we cannot render. With the frame header shown
 * (default) this is the bare artwork+copy row; without a header it wraps the
 * row in a card box so filename/size stay self-contained.
 */
export function buildFileCard(plugin: AnyViewerPlugin, file: TFile, opts?: { headerShown?: boolean }): HTMLElement {
  const headerShown = opts?.headerShown !== false;
  const content = buildUnavailableContent(plugin, file, { showName: !headerShown });
  if (headerShown) return content;

  const card = createDiv({ cls: "any-viewer-card" });
  card.appendChild(content);
  return card;
}
