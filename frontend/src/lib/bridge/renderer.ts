import type { ComponentPreview, RenderResult, ViewBox } from "./types";

export interface Renderer {
  renderDesign(result: RenderResult): { svg: string; viewBox: ViewBox };
  renderPreview(preview: ComponentPreview): { svg: string; viewBox: ViewBox };
}

export const SvgRenderer: Renderer = {
  renderDesign(result) {
    return { svg: result.svg, viewBox: result.viewBox };
  },
  renderPreview(preview) {
    return { svg: preview.svg, viewBox: preview.viewBox };
  },
};

export const activeRenderer: Renderer = SvgRenderer;
