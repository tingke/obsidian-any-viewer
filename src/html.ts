import { getIcon, requestUrl, TFile } from "obsidian";
import type AnyViewerPlugin from "./main";
import type { Dict } from "./i18n";

/**
 * Renders an HTML file inside a sandboxed iframe built with `srcdoc`.
 *
 * A plain `src` iframe is blocked by Obsidian's preview CSP (`frame-src 'none'`),
 * and external stylesheets referenced by srcdoc are blocked too (the CSP follows
 * the embed into the iframe). So, following the approach proven by
 * mnaoumov/obsidian-embed-html:
 *  1. parse the document, absolutize relative asset URLs against the vault
 *     resource URL, inline every external stylesheet;
 *  2. set the processed markup as the iframe's `srcdoc`;
 *  3. size the frame to the rendered content (capped by max height).
 */
export async function renderHtmlFrame(
  container: HTMLElement,
  data: ArrayBuffer,
  opts: { allowScripts: boolean; height?: number; width?: number; maxHeight?: number; resourceUrl?: string; scrollToId?: string; extractElement?: string }
): Promise<void> {
  const text = new TextDecoder().decode(data);
  const parsed = new DOMParser().parseFromString(text, "text/html");

  const baseDir = opts.resourceUrl
    ? opts.resourceUrl.slice(0, opts.resourceUrl.lastIndexOf("/") + 1)
    : undefined;
  const absolute = (u: string): string => {
    if (!baseDir) return u;
    try {
      return new URL(u, baseDir).toString();
    } catch {
      console.warn("[Any Viewer] failed to resolve asset URL", u);
      return u;
    }
  };
  const isExternal = (u: string) => /^(https?:|data:|blob:|app:)/i.test(u);

  // absolutize relative asset URLs (srcdoc inherits app://obsidian.md as base)
  parsed.querySelectorAll("img[src], script[src], source[src], video[src], audio[src], track[src]").forEach((el) => {
    const s = el.getAttribute("src");
    if (s && !isExternal(s)) el.setAttribute("src", absolute(s));
  });
  parsed.querySelectorAll("link[href]").forEach((el) => {
    const h = el.getAttribute("href");
    if (h && !isExternal(h)) el.setAttribute("href", absolute(h));
  });

  // external stylesheets are CSP-blocked inside the iframe — inline them
  const links = Array.from(parsed.querySelectorAll('link[rel="stylesheet"][href]'));
  await Promise.all(
    links.map(async (link) => {
      const href = link.getAttribute("href")!;
      try {
        const response = await requestUrl(href);
        const style = createEl("style");
        style.textContent = response.text;
        link.replaceWith(parsed.importNode(style, true));
      } catch (err) {
        console.warn("[Any Viewer] failed to inline stylesheet", href, String(err));
        /* keep the original link */
      }
    })
  );

  // `#元素id` frag semantics (v0.6 T3.2): keep ONLY the target element in the
  // body — <head> styles survive so the fragment keeps its styling context.
  // Unresolved id → silently render the whole page (consistent fallback).
  if (opts.extractElement) {
    const target = parsed.getElementById(opts.extractElement);
    if (target) {
      const body = parsed.body;
      while (body.firstChild) body.removeChild(body.firstChild);
      body.appendChild(target);
    } else {
      console.warn(`[Any Viewer] html element "#${opts.extractElement}" not found — rendering the whole page`);
    }
  }

  const sandbox = ["allow-forms", "allow-popups", "allow-modals", "allow-same-origin"];
  if (opts.allowScripts) sandbox.push("allow-scripts");

  const frame = container.createEl("iframe", {
    cls: "any-viewer-html-frame",
    attr: {
      referrerpolicy: "no-referrer",
    },
  });
  frame.setAttribute("sandbox", sandbox.join(" "));
  if (opts.width) frame.style.width = `${opts.width}px`;

  // `srcdoc` carries the markup on the element itself, so re-attaching the
  // iframe (e.g. when Obsidian re-renders the note) reloads it cleanly.
  frame.srcdoc = `<!DOCTYPE html>${parsed.documentElement.outerHTML}`;

  // Size the frame: explicit height hint wins; otherwise fit the content,
  // capped by the embed max height.
  frame.addEventListener("load", () => {
    const apply = () => {
      if (opts.height) {
        frame.style.height = `${opts.height}px`;
        return;
      }
      const docEl = frame.contentDocument?.documentElement;
      if (!docEl) return;
      const h = Math.max(docEl.scrollHeight, frame.contentDocument?.body?.scrollHeight ?? 0);
      const capped = opts.maxHeight ? Math.min(h, opts.maxHeight) : h;
      frame.style.height = `${Math.max(Math.ceil(capped), 120)}px`;
    };
    apply();
    // Display-syntax fragment `#element-id` (srcdoc is same-origin, so the
    // frame's document is directly reachable). Silent when not found.
    if (opts.scrollToId) {
      try {
        frame.contentDocument?.getElementById(opts.scrollToId)?.scrollIntoView({ block: "start" });
      } catch (err) {
        console.warn("[Any Viewer] fragment scroll failed", err);
      }
    }
    try {
      const docEl = frame.contentDocument?.documentElement;
      const body = frame.contentDocument?.body;
      const observer = new ResizeObserver(() => apply());
      if (docEl) observer.observe(docEl);
      if (body) observer.observe(body);
      // stop observing once our container goes away
      const reaper = window.setInterval(() => {
        if (!container.isConnected) {
          observer.disconnect();
          window.clearInterval(reaper);
        }
      }, 10_000);
    } catch (err) {
      console.warn("[Any Viewer] iframe height observation unavailable", err);
      /* fixed sizing still applies */
    }
  });
}

/**
 * Split raw HTML source into (class, text) tokens for cheap, zero-dependency
 * highlighting (v0.6 T3.1 验收反馈). Not a parser — a tokenizer good enough
 * for display: comments, doctype, tag names, attribute names/values, strings.
 */
function tokenizeHtmlSource(text: string): { cls: string | null; text: string }[] {
  const tokens: { cls: string | null; text: string }[] = [];
  const re = /(<!--[\s\S]*?-->)|(<!DOCTYPE[^>]*>)|(<\/?)([a-zA-Z][\w:.-]*)([^>]*?)(\/?>)|([^<]+)|</g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push({ cls: null, text: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      tokens.push({ cls: "tok-comment", text: m[1] });
    } else if (m[2] !== undefined) {
      tokens.push({ cls: "tok-doctype", text: m[2] });
    } else if (m[3] !== undefined) {
      tokens.push({ cls: "tok-punct", text: m[3] });
      tokens.push({ cls: "tok-tag", text: m[4] });
      const attrs = m[5];
      const attrRe = /([a-zA-Z_:][-\w:.]*)|(=)|("[^"]*"|'[^']*')|(\s+)|([^\s"'=]+)/g;
      let aLast = 0;
      let am: RegExpExecArray | null;
      while ((am = attrRe.exec(attrs))) {
        if (am.index > aLast) tokens.push({ cls: null, text: attrs.slice(aLast, am.index) });
        const cls = am[1] !== undefined ? "tok-attr" : am[2] !== undefined ? "tok-punct" : am[3] !== undefined ? "tok-string" : null;
        tokens.push({ cls, text: am[0] });
        aLast = am.index + am[0].length;
      }
      if (aLast < attrs.length) tokens.push({ cls: null, text: attrs.slice(aLast) });
      tokens.push({ cls: "tok-punct", text: m[6] });
    } else if (m[7] !== undefined) {
      tokens.push({ cls: null, text: m[7] });
    } else {
      tokens.push({ cls: "tok-punct", text: "<" });
    }
    last = re.lastIndex;
  }
  if (last < text.length) tokens.push({ cls: null, text: text.slice(last) });
  return tokens;
}

/**
 * Source view (v0.6 T3.1): left-aligned, syntax-highlighted raw HTML in a
 * scrolling <pre>. Highlighting stops at HIGHLIGHT_LIMIT (spans are per-token);
 * large files cap at MAX_CHARS so a multi-megabyte document can't freeze the
 * pane. buildSpan uses textContent only — the source is never parsed as HTML.
 */
export async function renderHtmlSource(container: HTMLElement, data: ArrayBuffer, opts?: { maxHeight?: number }): Promise<void> {
  const MAX_CHARS = 1_000_000;
  const HIGHLIGHT_LIMIT = 200_000;
  let text = new TextDecoder().decode(data);
  const truncated = text.length > MAX_CHARS;
  if (truncated) text = text.slice(0, MAX_CHARS);
  const box = container.createDiv({ cls: "any-viewer-html-source" });
  if (opts?.maxHeight) box.setCssProps({ maxHeight: `${opts.maxHeight}px` });
  const pre = box.createEl("pre", { cls: "any-viewer-html-source-code" });
  const highlightLength = Math.min(text.length, HIGHLIGHT_LIMIT);
  for (const token of tokenizeHtmlSource(text.slice(0, highlightLength))) {
    const span = pre.createSpan({ cls: token.cls ?? undefined });
    span.setText(token.text);
  }
  if (text.length > highlightLength) pre.createSpan({ text: text.slice(highlightLength) });
  if (truncated) pre.createSpan({ text: "\n\n<!-- … truncated / 已截断 -->" });
}

/**
 * Toggle one embed between reading (iframe) and source view. State lives on
 * the stage element (dataset), so a fresh render always starts in reading
 * mode. Swaps the button icon/label to reflect the mode being switched TO.
 */
export async function toggleHtmlView(
  plugin: AnyViewerPlugin,
  stage: HTMLElement,
  file: TFile,
  btn: HTMLButtonElement,
  T: Dict,
  opts: { allowScripts?: boolean; heightHint?: number; maxHeight?: number; extractElement?: string }
): Promise<void> {
  const toSource = stage.dataset.htmlSource !== "1";
  stage.dataset.htmlSource = toSource ? "1" : "0";
  const icon = getIcon(toSource ? "book-open" : "code");
  if (icon) btn.replaceChildren(icon);
  btn.setAttribute("aria-label", toSource ? T.viewReading : T.viewSource);
  stage.empty();
  const data = await plugin.app.vault.readBinary(file);
  if (toSource) {
    await renderHtmlSource(stage, data, { maxHeight: opts.maxHeight });
  } else {
    // Keep the embed's `#元素id` frag semantics (extraction) across the toggle —
    // otherwise toggling back to reading mode silently widens to the whole page.
    await renderHtmlFrame(stage, data, {
      allowScripts: opts.allowScripts ?? true,
      height: opts.heightHint,
      maxHeight: opts.maxHeight,
      resourceUrl: plugin.app.vault.getResourcePath(file),
      extractElement: opts.extractElement,
    });
  }
}
