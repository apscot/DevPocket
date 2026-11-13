export interface Run { text: string; cls: string }
export interface CodeTheme { name: string; bg: string; fg: string; gutter: string; colors: Record<string, string> }
const mk = (name: string, bg: string, fg: string, gutter: string, c: [string, string][]): CodeTheme => ({ name, bg, fg, gutter, colors: Object.fromEntries(c) })
export const THEMES: Record<string, CodeTheme> = {
  midnight: mk('Midnight', '#0f172a', '#e2e8f0', '#475569', [['keyword', '#c084fc'], ['built_in', '#38bdf8'], ['type', '#38bdf8'], ['literal', '#fb923c'], ['number', '#fb923c'], ['string', '#86efac'], ['regexp', '#86efac'], ['comment', '#64748b'], ['doctag', '#64748b'], ['function', '#7dd3fc'], ['title', '#7dd3fc'], ['attr', '#7dd3fc'], ['attribute', '#7dd3fc'], ['variable', '#fca5a5'], ['params', '#e2e8f0'], ['meta', '#f472b6'], ['name', '#fca5a5'], ['tag', '#fca5a5'], ['symbol', '#fb923c'], ['property', '#7dd3fc'], ['punctuation', '#94a3b8'], ['operator', '#94a3b8']]),
  dracula: mk('Dracula', '#282a36', '#f8f8f2', '#6272a4', [['keyword', '#ff79c6'], ['built_in', '#8be9fd'], ['type', '#8be9fd'], ['literal', '#bd93f9'], ['number', '#bd93f9'], ['string', '#f1fa8c'], ['regexp', '#f1fa8c'], ['comment', '#6272a4'], ['function', '#50fa7b'], ['title', '#50fa7b'], ['attr', '#50fa7b'], ['attribute', '#50fa7b'], ['variable', '#ffb86c'], ['meta', '#ff79c6'], ['name', '#ff79c6'], ['tag', '#ff79c6'], ['symbol', '#bd93f9'], ['property', '#8be9fd']]),
  light: mk('Paper', '#ffffff', '#1f2937', '#9ca3af', [['keyword', '#7c3aed'], ['built_in', '#0369a1'], ['type', '#0369a1'], ['literal', '#c2410c'], ['number', '#c2410c'], ['string', '#15803d'], ['regexp', '#15803d'], ['comment', '#9ca3af'], ['function', '#1d4ed8'], ['title', '#1d4ed8'], ['attr', '#1d4ed8'], ['attribute', '#1d4ed8'], ['variable', '#b91c1c'], ['meta', '#be185d'], ['name', '#b91c1c'], ['tag', '#b91c1c'], ['symbol', '#c2410c'], ['property', '#0369a1']]),
  solarized: mk('Solarized Dark', '#002b36', '#93a1a1', '#586e75', [['keyword', '#859900'], ['built_in', '#268bd2'], ['type', '#b58900'], ['literal', '#cb4b16'], ['number', '#d33682'], ['string', '#2aa198'], ['regexp', '#2aa198'], ['comment', '#586e75'], ['function', '#268bd2'], ['title', '#268bd2'], ['attr', '#b58900'], ['attribute', '#b58900'], ['variable', '#cb4b16'], ['meta', '#6c71c4'], ['name', '#268bd2'], ['tag', '#268bd2'], ['symbol', '#d33682'], ['property', '#268bd2']]),
  mono: mk('Monochrome', '#18181b', '#e4e4e7', '#52525b', [['keyword', '#ffffff'], ['string', '#a1a1aa'], ['comment', '#52525b'], ['number', '#d4d4d8'], ['function', '#ffffff'], ['title', '#ffffff']]),
}
export const BACKGROUNDS: Record<string, string[]> = { teal: ['#0f766e', '#115e59'], indigo: ['#4338ca', '#6d28d9'], sunset: ['#f97316', '#db2777'], slate: ['#334155', '#0f172a'], ocean: ['#0ea5e9', '#2563eb'], paper: ['#f5f5f4', '#e7e5e4'], none: [] }

/** Convert highlight.js HTML into colored runs split per line. */
export function htmlToLines(html: string): Run[][] {
  const root = document.createElement('div'); root.innerHTML = html
  const lines: Run[][] = [[]]
  const walk = (n: Node, cls: string) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const parts = (n.textContent ?? '').split('\n')
      parts.forEach((p, i) => { if (i > 0) lines.push([]); if (p) lines[lines.length - 1].push({ text: p, cls }) })
    } else if (n instanceof HTMLElement) { const c = [...n.classList].find((x) => x.startsWith('hljs-'))?.slice(5) ?? cls; n.childNodes.forEach((ch) => walk(ch, c)) }
  }
  root.childNodes.forEach((n) => walk(n, ''))
  return lines
}
const colorFor = (t: CodeTheme, cls: string) => { const base = cls.split('_')[0]; return t.colors[cls] ?? t.colors[base] ?? t.fg }

export interface RenderOpts { lines: Run[][]; theme: CodeTheme; fontSize: number; padding: number; bgKey: string; lineNumbers: boolean; windowChrome: boolean; title: string; scale: number; radius: number }
export function renderCodeImage(o: RenderOpts): HTMLCanvasElement {
  const fs = o.fontSize, lh = Math.round(fs * 1.6), font = `${fs}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`
  const meas = document.createElement('canvas').getContext('2d')!; meas.font = font
  const cw = meas.measureText('M').width
  const tab = (s: string) => s.replace(/\t/g, '    ')
  const maxCols = Math.max(1, ...o.lines.map((l) => l.reduce((n, r) => n + tab(r.text).length, 0)))
  const gutter = o.lineNumbers ? String(o.lines.length).length * cw + 24 : 0
  const chrome = o.windowChrome ? 44 : 0
  const innerPad = 20
  const winW = Math.ceil(gutter + maxCols * cw + innerPad * 2), winH = chrome + o.lines.length * lh + innerPad * 2
  const bg = BACKGROUNDS[o.bgKey] ?? []
  const outer = bg.length ? o.padding : 0
  const W = winW + outer * 2, H = winH + outer * 2
  const c = document.createElement('canvas'); c.width = Math.ceil(W * o.scale); c.height = Math.ceil(H * o.scale)
  const x = c.getContext('2d')!; x.scale(o.scale, o.scale)
  if (bg.length) { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1] ?? bg[0]); x.fillStyle = g; x.fillRect(0, 0, W, H) }
  const rr = (px: number, py: number, w: number, h: number, r: number) => { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath() }
  if (bg.length) { x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 30; x.shadowOffsetY = 14; x.fillStyle = o.theme.bg; rr(outer, outer, winW, winH, o.radius); x.fill(); x.restore() }
  x.fillStyle = o.theme.bg; rr(outer, outer, winW, winH, o.radius); x.fill()
  if (o.windowChrome) {
    ;['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(outer + 22 + i * 20, outer + 22, 6, 0, Math.PI * 2); x.fill() })
    if (o.title) { x.fillStyle = o.theme.gutter; x.font = `${Math.max(11, fs - 2)}px ui-sans-serif, system-ui, sans-serif`; x.textAlign = 'center'; x.fillText(o.title, outer + winW / 2, outer + 26); x.textAlign = 'left' }
  }
  x.font = font; x.textBaseline = 'alphabetic'
  o.lines.forEach((line, li) => {
    const y = outer + chrome + innerPad + li * lh + lh * 0.72; let px = outer + innerPad
    if (o.lineNumbers) { x.fillStyle = o.theme.gutter; x.textAlign = 'right'; x.fillText(String(li + 1), px + gutter - 16, y); x.textAlign = 'left'; px += gutter }
    for (const r of line) { const t = tab(r.text); x.fillStyle = colorFor(o.theme, r.cls); x.fillText(t, px, y); px += t.length * cw }
  })
  return c
}
