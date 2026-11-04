/** Render an HTML file inside a sandboxed iframe. */
export function renderHtmlFrame(
  container: HTMLElement,
  src: string,
  opts: { height?: number; allowScripts: boolean }
): void {
  const sandbox = ["allow-forms", "allow-popups", "allow-modals"];
  if (opts.allowScripts) sandbox.push("allow-scripts");

  const frame = container.createEl("iframe", {
    cls: "any-viewer-html-frame",
    attr: {
      src,
      sandbox: sandbox.join(" "),
      loading: "lazy",
      referrerpolicy: "no-referrer",
    },
  });
  if (opts.height) frame.style.height = `${opts.height}px`;
}
