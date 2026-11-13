import { normalizeSvg, svgSize } from './mdviewer'

/** Rasterizes an SVG string to a PNG blob at `scale`x (capped so the canvas stays within browser limits). */
export async function svgToPng(svg: string, scale = 3, bg = '#ffffff'): Promise<{ blob: Blob; w: number; h: number }> {
  const { w, h } = svgSize(svg)
  const k = Math.max(0.5, Math.min(scale, 12000 / Math.max(w, h)))
  const url = URL.createObjectURL(new Blob([normalizeSvg(svg)], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image(); img.decoding = 'async'
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('Could not rasterize the diagram')); img.src = url })
    const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k)
    const x = c.getContext('2d'); if (!x) throw new Error('Canvas is not available')
    if (bg !== 'transparent') { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height) } x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
    if (!blob) throw new Error('PNG encoding failed')
    return { blob, w, h }
  } finally { URL.revokeObjectURL(url) }
}
