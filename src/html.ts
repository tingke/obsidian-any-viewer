import { requestUrl } from "obsidian";

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
  opts: { allowScripts: boolean; height?: number; width?: number; maxHeight?: number; resourceUrl?: string }
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
