import type { Pt, Rect, ShapeKind, Style } from './types'

export interface ShapeGeom {
  /** how the body is drawn */
  prim: 'rect' | 'ellipse' | 'path' | 'none'
  d?: string
  /** extra decoration paths (never filled) */
  details: string[]
  /** outline polygon in local coords: hit-testing, borders, sketch mode */
  poly: Pt[]
  /** whether `poly` is accurate enough to draw in sketch mode */
  rough: boolean
  /** rectangle (local) where text goes */
  text: Rect
}

const P = (x: number, y: number): Pt => ({ x, y })
const rectPoly = (w: number, h: number) => [P(0, 0), P(w, 0), P(w, h), P(0, h)]
const ellipsePoly = (w: number, h: number, n = 36) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return P(w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)) })
const polyD = (pts: Pt[]) => `M${pts.map((p) => `${r2(p.x)} ${r2(p.y)}`).join(' L')} Z`
const r2 = (n: number) => Math.round(n * 100) / 100

/** Scales a path template authored in a W x H box. Every command must take (x y) pairs (M, L, C, Z). */
function scaleTpl(tpl: string, w: number, h: number, W: number, H: number) {
  return tpl.replace(/(-?[\d.]+)[ ,](-?[\d.]+)/g, (_m, x: string, y: string) => `${r2((parseFloat(x) * w) / W)} ${r2((parseFloat(y) * h) / H)}`)
}
const CLOUD = 'M25 50 C10 50 5 35 18 30 C15 15 35 5 45 15 C55 0 80 5 80 20 C95 20 98 40 85 47 C85 55 70 56 65 50 C55 58 35 58 25 50 Z'
const DOC = 'M0 0 L100 0 L100 88 C85 80 70 80 50 88 C30 96 15 96 0 88 Z'
const CALLOUT = 'M0 0 L100 0 L100 72 L42 72 L22 100 L26 72 L0 72 Z'
const PACKAGE = 'M0 0 L42 0 L42 12 L100 12 L100 100 L0 100 Z'

function star(w: number, h: number): Pt[] {
  return Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const k = i % 2 ? 0.42 : 1; return P(w / 2 + Math.cos(a) * (w / 2) * k, h / 2 + Math.sin(a) * (h / 2) * k) })
}

export function shapeGeom(kind: ShapeKind, w: number, h: number, radius = 0): ShapeGeom {
  const full: Rect = { x: 0, y: 0, w, h }
  switch (kind) {
    case 'rect': case 'note': return { prim: 'rect', details: [], poly: rectPoly(w, h), rough: true, text: full }
    case 'ellipse': return { prim: 'ellipse', details: [], poly: ellipsePoly(w, h), rough: true, text: { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 } }
    case 'diamond': { const p = [P(w / 2, 0), P(w, h / 2), P(w / 2, h), P(0, h / 2)]; return { prim: 'path', d: polyD(p), details: [], poly: p, rough: true, text: { x: w * 0.2, y: h * 0.2, w: w * 0.6, h: h * 0.6 } } }
    case 'triangle': { const p = [P(w / 2, 0), P(w, h), P(0, h)]; return { prim: 'path', d: polyD(p), details: [], poly: p, rough: true, text: { x: w * 0.25, y: h * 0.4, w: w * 0.5, h: h * 0.55 } } }
    case 'hexagon': { const k = w * 0.22; const p = [P(k, 0), P(w - k, 0), P(w, h / 2), P(w - k, h), P(k, h), P(0, h / 2)]; return { prim: 'path', d: polyD(p), details: [], poly: p, rough: true, text: { x: k * 0.6, y: 0, w: w - k * 1.2, h } } }
    case 'parallelogram': { const k = Math.min(w * 0.22, h); const p = [P(k, 0), P(w, 0), P(w - k, h), P(0, h)]; return { prim: 'path', d: polyD(p), details: [], poly: p, rough: true, text: { x: k * 0.8, y: 0, w: w - k * 1.6, h } } }
    case 'trapezoid': { const k = Math.min(w * 0.2, h); const p = [P(k, 0), P(w - k, 0), P(w, h), P(0, h)]; return { prim: 'path', d: polyD(p), details: [], poly: p, rough: true, text: { x: k * 0.7, y: 0, w: w - k * 1.4, h } } }
    case 'chevron': { const k = Math.min(h / 2, w * 0.3); const p = [P(0, 0), P(w - k, 0), P(w, h / 2), P(w - k, h), P(0, h), P(k, h / 2)]; return { prim: 'path', d: polyD(p), details: [], poly: p, rough: true, text: { x: k, y: 0, w: w - k * 2, h } } }
    case 'star': { const p = star(w, h); return { prim: 'path', d: polyD(p), details: [], poly: p, rough: true, text: { x: w * 0.3, y: h * 0.35, w: w * 0.4, h: h * 0.35 } } }
    case 'cylinder': {
      const ry = Math.min(h * 0.16, w * 0.3)
      const d = `M0 ${r2(ry)} A${r2(w / 2)} ${r2(ry)} 0 0 1 ${r2(w)} ${r2(ry)} L${r2(w)} ${r2(h - ry)} A${r2(w / 2)} ${r2(ry)} 0 0 1 0 ${r2(h - ry)} Z`
      return { prim: 'path', d, details: [`M0 ${r2(ry)} A${r2(w / 2)} ${r2(ry)} 0 0 0 ${r2(w)} ${r2(ry)}`], poly: rectPoly(w, h), rough: false, text: { x: 0, y: ry * 2, w, h: h - ry * 3 } }
    }
    case 'cloud': return { prim: 'path', d: scaleTpl(CLOUD, w, h, 100, 62), details: [], poly: ellipsePoly(w, h), rough: false, text: { x: w * 0.15, y: h * 0.25, w: w * 0.7, h: h * 0.5 } }
    case 'document': return { prim: 'path', d: scaleTpl(DOC, w, h, 100, 100), details: [], poly: rectPoly(w, h), rough: false, text: { x: 0, y: 0, w, h: h * 0.85 } }
    case 'callout': return { prim: 'path', d: scaleTpl(CALLOUT, w, h, 100, 100), details: [], poly: rectPoly(w, h), rough: false, text: { x: 0, y: 0, w, h: h * 0.72 } }
    case 'package': return { prim: 'path', d: scaleTpl(PACKAGE, w, h, 100, 100), details: [], poly: rectPoly(w, h), rough: false, text: { x: 0, y: h * 0.14, w, h: h * 0.86 } }
    case 'process': { const k = Math.min(14, w * 0.12); return { prim: 'rect', details: [`M${r2(k)} 0 V${r2(h)}`, `M${r2(w - k)} 0 V${r2(h)}`], poly: rectPoly(w, h), rough: false, text: { x: k, y: 0, w: w - k * 2, h } } }
    case 'class': { const head = Math.min(30, h * 0.34); const body = (h - head) / 2; return { prim: 'rect', details: [`M0 ${r2(head)} H${r2(w)}`, `M0 ${r2(head + body)} H${r2(w)}`], poly: rectPoly(w, h), rough: false, text: { x: 0, y: 0, w, h } } }
    case 'actor': {
      const cx = w / 2; const hr = Math.min(w * 0.22, h * 0.14); const top = hr * 2 + 2; const bodyEnd = h * 0.62
      return { prim: 'none', details: [`M${r2(cx - hr)} ${r2(hr)} a${r2(hr)} ${r2(hr)} 0 1 0 ${r2(hr * 2)} 0 a${r2(hr)} ${r2(hr)} 0 1 0 ${r2(-hr * 2)} 0`, `M${r2(cx)} ${r2(top)} V${r2(bodyEnd)}`, `M${r2(cx - w * 0.3)} ${r2(top + (bodyEnd - top) * 0.3)} H${r2(cx + w * 0.3)}`, `M${r2(cx)} ${r2(bodyEnd)} L${r2(cx - w * 0.28)} ${r2(h * 0.86)}`, `M${r2(cx)} ${r2(bodyEnd)} L${r2(cx + w * 0.28)} ${r2(h * 0.86)}`], poly: rectPoly(w, h), rough: false, text: { x: 0, y: h * 0.88, w, h: Math.max(8, h * 0.12) } }
    }
    case 'icon': return { prim: 'none', details: [], poly: rectPoly(w, h), rough: false, text: { x: 0, y: h * 0.72, w, h: h * 0.28 } }
    case 'text': return { prim: 'none', details: [], poly: rectPoly(w, h), rough: false, text: full }
  }
}

/** Is the text for this kind drawn below the shape rather than inside it? */
export const labelBelow = (k: ShapeKind) => k === 'actor' || k === 'icon'
/** Kinds with an interior that should be hit-testable even without a fill. */
export const alwaysSolid = (k: ShapeKind) => k === 'text' || k === 'icon' || k === 'note' || k === 'actor'

export function rectRadius(s: Style, w: number, h: number) { return Math.max(0, Math.min(s.radius, Math.min(w, h) / 2)) }

// ---------- icons (24x24 grid, stroke only) ----------
export const ICONS: Record<string, string[]> = {
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8'],
  server: ['M3 4h18v6H3z', 'M3 14h18v6H3z', 'M7 7h.01', 'M7 17h.01'],
  database: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
  browser: ['M3 5h18v14H3z', 'M3 9h18', 'M6 7h.01', 'M9 7h.01'],
  mobile: ['M7 2h10v20H7z', 'M11 18h2'],
  cloud: ['M7 18a4 4 0 0 1-.6-7.9 6 6 0 0 1 11.5 1.4A3.3 3.3 0 0 1 17 18z'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z'],
  queue: ['M3 7h18v10H3z', 'M8 7v10', 'M13 7v10', 'M18 7v10'],
  gear: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M5 5l2 2', 'M17 17l2 2', 'M19 5l-2 2', 'M7 17l-2 2'],
  file: ['M6 2h8l5 5v15H6z', 'M14 2v5h5', 'M9 13h7', 'M9 17h7'],
  mail: ['M3 5h18v14H3z', 'M3 6l9 7 9-7'],
  shield: ['M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z'],
  box: ['M12 2l9 5v10l-9 5-9-5V7z', 'M12 12l9-5', 'M12 12v10', 'M12 12L3 7'],
  balance: ['M12 3v18', 'M6 21h12', 'M5 7h14', 'M5 7l-3 7a3 3 0 0 0 6 0z', 'M19 7l-3 7a3 3 0 0 0 6 0z'],
  code: ['M8 7l-5 5 5 5', 'M16 7l5 5-5 5', 'M14 4l-4 16'],
}
export const ICON_LABELS: Record<string, string> = { user: 'User', server: 'Server', database: 'Database', browser: 'Browser', mobile: 'Mobile', cloud: 'Cloud', lock: 'Security', globe: 'Internet', queue: 'Queue', gear: 'Service', file: 'File', mail: 'Email', shield: 'Firewall', box: 'Container', balance: 'Load balancer', code: 'API' }
