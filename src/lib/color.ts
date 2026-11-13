export interface RGB { r: number; g: number; b: number; a: number }
export interface HSL { h: number; s: number; l: number; a: number }
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n))
export const NAMED: Record<string, string> = { black: '#000000', white: '#ffffff', red: '#ff0000', lime: '#00ff00', blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff', silver: '#c0c0c0', gray: '#808080', grey: '#808080', maroon: '#800000', olive: '#808000', green: '#008000', purple: '#800080', teal: '#008080', navy: '#000080', orange: '#ffa500', pink: '#ffc0cb', brown: '#a52a2a', gold: '#ffd700', indigo: '#4b0082', violet: '#ee82ee', coral: '#ff7f50', salmon: '#fa8072', tomato: '#ff6347', crimson: '#dc143c', turquoise: '#40e0d0', skyblue: '#87ceeb', steelblue: '#4682b4', slategray: '#708090', rebeccapurple: '#663399', transparent: '#00000000' }

export function parseColor(input: string): RGB {
  const s = input.trim().toLowerCase()
  if (!s) throw new Error('Enter a color.')
  if (NAMED[s]) return parseColor(NAMED[s])
  let m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s)
  if (m) {
    let h = m[1]; if (h.length <= 4) h = [...h].map((c) => c + c).join('')
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? +(parseInt(h.slice(6, 8), 16) / 255).toFixed(3) : 1 }
  }
  const num = (x: string, pct = 255) => (x.endsWith('%') ? (parseFloat(x) / 100) * pct : parseFloat(x))
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s)
  if (m) { const c = [num(m[1]), num(m[2]), num(m[3])]; if (c.some((v) => Number.isNaN(v) || v < 0 || v > 255)) throw new Error('RGB channels must be 0–255.'); return { r: Math.round(c[0]), g: Math.round(c[1]), b: Math.round(c[2]), a: m[4] ? clamp(num(m[4], 1)) : 1 } }
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s)
  if (m) { const h = parseFloat(m[1]), sa = parseFloat(m[2]), l = parseFloat(m[3]); if (sa > 100 || l > 100) throw new Error('Saturation and lightness must be 0–100%.'); return { ...hslToRgb({ h, s: sa / 100, l: l / 100, a: 1 }), a: m[4] ? clamp(num(m[4], 1)) : 1 } }
  throw new Error('Unrecognized color. Use #RRGGBB, rgb(r, g, b), hsl(h, s%, l%) or a CSS color name.')
}
export function rgbToHsl({ r, g, b, a }: RGB): HSL {
  const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min
  const l = (max + min) / 2; let h = 0, s = 0
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4; h *= 60; if (h < 0) h += 360 }
  return { h, s, l, a }
}
export function hslToRgb({ h, s, l, a }: HSL): RGB {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255), a }
}
const hx = (n: number) => Math.round(n).toString(16).padStart(2, '0')
export const toHex = (c: RGB, withAlpha = false) => `#${hx(c.r)}${hx(c.g)}${hx(c.b)}${withAlpha || c.a < 1 ? hx(c.a * 255) : ''}`.toUpperCase()
export const toRgbString = (c: RGB) => (c.a < 1 ? `rgba(${c.r}, ${c.g}, ${c.b}, ${+c.a.toFixed(3)})` : `rgb(${c.r}, ${c.g}, ${c.b})`)
export const toHslString = (c: RGB) => { const h = rgbToHsl(c); const f = `${Math.round(h.h)}, ${Math.round(h.s * 100)}%, ${Math.round(h.l * 100)}%`; return c.a < 1 ? `hsla(${f}, ${+c.a.toFixed(3)})` : `hsl(${f})` }
export function luminance({ r, g, b }: RGB): number {
  const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrastRatio(a: RGB, b: RGB): number { const l1 = luminance(a), l2 = luminance(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
export const wcag = (ratio: number) => ({ aaNormal: ratio >= 4.5, aaLarge: ratio >= 3, aaaNormal: ratio >= 7, aaaLarge: ratio >= 4.5, ui: ratio >= 3 })
/** Find the closest foreground (by lightness shift) that reaches `target` ratio against bg. */
export function suggestForeground(fg: RGB, bg: RGB, target = 4.5): RGB | null {
  const h = rgbToHsl(fg)
  for (let d = 0; d <= 1; d += 0.01) for (const dir of [-1, 1]) { const c = hslToRgb({ ...h, l: clamp(h.l + dir * d) }); if (contrastRatio(c, bg) >= target) return c }
  return null
}
export type Scheme = 'complementary' | 'analogous' | 'triadic' | 'tetradic' | 'split' | 'monochromatic'
export function palette(base: RGB, scheme: Scheme, count = 5): RGB[] {
  const h = rgbToHsl(base); const at = (deg: number, l = h.l, s = h.s) => hslToRgb({ h: h.h + deg, s: clamp(s), l: clamp(l), a: 1 })
  switch (scheme) {
    case 'complementary': return [at(0), at(180), at(0, clamp(h.l + 0.2)), at(180, clamp(h.l + 0.2)), at(0, clamp(h.l - 0.2))].slice(0, Math.max(2, count))
    case 'analogous': return Array.from({ length: count }, (_, i) => at((i - Math.floor(count / 2)) * 30))
    case 'triadic': return [at(0), at(120), at(240), at(0, clamp(h.l + 0.2)), at(120, clamp(h.l + 0.2)), at(240, clamp(h.l + 0.2))].slice(0, Math.max(3, count))
    case 'tetradic': return [at(0), at(90), at(180), at(270), at(0, clamp(h.l + 0.2))].slice(0, Math.max(4, count))
    case 'split': return [at(0), at(150), at(210), at(0, clamp(h.l + 0.2)), at(0, clamp(h.l - 0.2))].slice(0, Math.max(3, count))
    case 'monochromatic': return Array.from({ length: count }, (_, i) => at(0, 0.15 + (0.7 * i) / Math.max(1, count - 1)))
  }
}
