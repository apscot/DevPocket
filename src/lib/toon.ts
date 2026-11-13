// JSON → TOON (Token-Oriented Object Notation) encoder.
export interface ToonOpts { indent?: number; delimiter?: ',' | '\t' | '|'; lengthMarker?: boolean }
type Prim = string | number | boolean | null
const isPrim = (v: unknown): v is Prim => v === null || ['string', 'number', 'boolean'].includes(typeof v)
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function num(n: number): string {
  if (!Number.isFinite(n)) return 'null'
  if (Object.is(n, -0)) return '0'
  const s = String(n)
  return /e/i.test(s) ? n.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 20 }) : s
}
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
function str(s: string, d: string): string {
  const needs = s === '' || s !== s.trim() || /^(true|false|null)$/.test(s) || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s) || /^0\d+$/.test(s) || s.startsWith('-') || s.includes(d) || /[:"\\[\]{}\n\r\t]/.test(s)
  return needs ? `"${esc(s)}"` : s
}
const prim = (v: Prim, d: string) => (typeof v === 'string' ? str(v, d) : typeof v === 'number' ? num(v) : String(v))
const key = (k: string) => (/^[A-Za-z_][\w.]*$/.test(k) ? k : `"${esc(k)}"`)

export function toToon(value: unknown, o: ToonOpts = {}): string {
  const ind = o.indent ?? 2, d = o.delimiter ?? ','
  const pad = (n: number) => ' '.repeat(ind * n)
  const hdr = (n: number) => `[${o.lengthMarker ? '#' : ''}${n}${d === ',' ? '' : d}]`
  const entries = (obj: Record<string, unknown>, depth: number): string[] => Object.entries(obj).flatMap(([k, v]) => entry(key(k), v, depth))
  const entry = (k: string, v: unknown, depth: number): string[] => {
    if (isPrim(v)) return [`${pad(depth)}${k}: ${prim(v, d)}`]
    if (Array.isArray(v)) return arr(k, v, depth)
    const o = v as Record<string, unknown>
    return Object.keys(o).length ? [`${pad(depth)}${k}:`, ...entries(o, depth + 1)] : [`${pad(depth)}${k}:`]
  }
  const arr = (k: string, a: unknown[], depth: number): string[] => {
    const p = pad(depth)
    if (!a.length) return [`${p}${k}${hdr(0)}:`]
    if (a.every(isPrim)) return [`${p}${k}${hdr(a.length)}: ${a.map((x) => prim(x as Prim, d)).join(d)}`]
    if (a.every(isObj)) {
      const f = Object.keys(a[0] as object)
      const uniform = f.length > 0 && a.every((x) => { const ks = Object.keys(x as object); return ks.length === f.length && f.every((q) => ks.includes(q)) && f.every((q) => isPrim((x as Record<string, unknown>)[q])) })
      if (uniform) return [`${p}${k}${hdr(a.length)}{${f.map(key).join(d)}}:`, ...a.map((x) => pad(depth + 1) + f.map((q) => prim((x as Record<string, Prim>)[q], d)).join(d))]
    }
    const lines = [`${p}${k}${hdr(a.length)}:`]
    for (const it of a) {
      const mark = (ls: string[], at: number) => { ls[0] = pad(at) + '- ' + ls[0].trimStart(); return ls }
      if (isPrim(it)) lines.push(`${pad(depth + 1)}- ${prim(it, d)}`)
      else if (Array.isArray(it)) lines.push(...mark(arr('', it, depth + 2), depth + 1))
      else { const ls = entries(it as Record<string, unknown>, depth + 2); lines.push(...(ls.length ? mark(ls, depth + 1) : [`${pad(depth + 1)}-`])) }
    }
    return lines
  }
  if (isPrim(value)) return prim(value, d)
  if (Array.isArray(value)) return arr('', value, 0).join('\n')
  return entries(value as Record<string, unknown>, 0).join('\n')
}
