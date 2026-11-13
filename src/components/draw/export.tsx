import type { El } from '@/lib/draw/types'
import { boundsOf, isDarkColor, nodeMap, padRect } from '@/lib/draw/geom'
import { SceneDefs, SceneView } from './SceneView'

/** Standalone, self-contained SVG of the elements (same renderer as the canvas, so exports match what you see). */
export async function sceneToSvg(els: El[], bg: string, o: { pad?: number; transparent?: boolean } = {}): Promise<{ svg: string; w: number; h: number }> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const b = boundsOf(els) ?? { x: 0, y: 0, w: 200, h: 120 }
  const r = padRect(b, o.pad ?? 28); const w = Math.ceil(r.w), h = Math.ceil(r.h)
  const body = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${Math.floor(r.x)} ${Math.floor(r.y)} ${w} ${h}`} width={w} height={h}>
      <SceneDefs uid="dpx" />
      {!o.transparent && <rect x={Math.floor(r.x)} y={Math.floor(r.y)} width={w} height={h} fill={bg} />}
      <SceneView els={els} nodes={nodeMap(els)} ctx={{ uid: 'dpx', bg, dark: isDarkColor(bg) }} />
    </svg>,
  )
  return { svg: `<?xml version="1.0" encoding="UTF-8"?>\n${body}`, w, h }
}

/** Opens the browser print dialog for an SVG (choose "Save as PDF"). */
export function printSvg(svg: string, title: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/[<>&]/g, '')}</title><style>@page{margin:10mm}html,body{margin:0}svg{max-width:100%;height:auto;display:block}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${svg.replace(/^<\?xml[^>]*>\s*/, '')}</body></html>`
  const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  f.onload = () => setTimeout(() => { f.contentWindow?.focus(); f.contentWindow?.print(); setTimeout(() => f.remove(), 120000) }, 250)
  f.srcdoc = html; document.body.appendChild(f)
}
