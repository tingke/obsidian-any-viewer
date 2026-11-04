declare module "pptx-preview" {
  export interface PptxViewer {
    preview(data: ArrayBuffer): void;
  }
  export interface PptxInitOptions {
    width?: number;
    height?: number;
  }
  export function init(el: HTMLElement, opts?: PptxInitOptions): PptxViewer;
}
