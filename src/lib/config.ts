import * as yaml from 'js-yaml'

export type Flat = Map<string, string>

export function parseProperties(text: string): Flat {
  const out: Flat = new Map()
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const unescape = (s: string) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\([tnrf])/g, (_, c) => ({ t: '\t', n: '\n', r: '\r', f: '\f' } as Record<string, string>)[c]).replace(/\\(.)/g, '$1')
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/^\s+/, '')
    if (!line || line[0] === '#' || line[0] === '!') continue
    while (/(^|[^\\])(\\\\)*\\$/.test(line) && i + 1 < lines.length) { line = line.slice(0, -1) + lines[++i].replace(/^\s+/, '') }
    let k = 0, key = ''
    while (k < line.length) {
      const c = line[k]
      if (c === '\\') { key += line.slice(k, k + 2); k += 2; continue }
      if (c === '=' || c === ':' || c === ' ' || c === '\t') break
      key += c; k++
    }
    let rest = line.slice(k).replace(/^[ \t]*[=:]?[ \t]*/, '')
    out.set(unescape(key), unescape(rest))
  }
  return out
}

export function flattenValue(v: unknown, prefix: string, out: Flat) {
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
    const entries: [string, unknown][] = Array.isArray(v) ? v.map((x, i) => [`[${i}]`, x]) : Object.entries(v as object)
    if (!entries.length) { out.set(prefix, Array.isArray(v) ? '[]' : '{}'); return }
    for (const [k, x] of entries) flattenValue(x, Array.isArray(v) ? prefix + k : prefix ? `${prefix}.${k}` : k, out)
  } else out.set(prefix, v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v))
}
export function parseYamlFlat(text: string): Flat {
  const out: Flat = new Map()
  const docs = yaml.loadAll(text)
  for (const d of docs) if (d !== null && d !== undefined) { if (typeof d !== 'object') throw new Error('YAML root must be a mapping.'); flattenValue(d, '', out) }
  return out
}
export function detectFormat(text: string, filename = ''): 'yaml' | 'properties' {
  if (/\.ya?ml$/i.test(filename)) return 'yaml'
  if (/\.properties$/i.test(filename)) return 'properties'
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !/^\s*[#!]/.test(l))
  if (lines.some((l) => /^---\s*$/.test(l)) || lines.some((l) => /^\s*[\w.-]+:\s*($|[^/\s])/.test(l) && !/=/.test(l.split(':')[0]) && !/^[\w.-]+\s*=/.test(l)) && !lines.every((l) => /^[\w.\-\[\]]+\s*[=]/.test(l))) return 'yaml'
  return 'properties'
}
export function parseConfig(text: string, fmt: 'auto' | 'yaml' | 'properties', filename = ''): Flat {
  const f = fmt === 'auto' ? detectFormat(text, filename) : fmt
  return f === 'yaml' ? parseYamlFlat(text) : parseProperties(text)
}

export const SENSITIVE = /(pass(word|wd)?|pwd|secret|token|credential|api[-_.]?key|private[-_.]?key|access[-_.]?key|auth|bearer|signature|salt|cert(ificate)?[-_.]?key)/i
export const isSensitiveKey = (k: string) => SENSITIVE.test(k)
export const maskValue = (v: string) => (v === '' ? '' : '••••••••')

export type Status = 'added' | 'removed' | 'modified' | 'unchanged'
export interface CompareRow { key: string; status: Status; left?: string; right?: string }
export function relaxKey(k: string) { return k.replace(/\[(\d+)\]/g, '.$1').toLowerCase().replace(/[-_]/g, '') }
export function compareFlat(a: Flat, b: Flat, o: { relaxed?: boolean; ignoreValueCase?: boolean; trimValues?: boolean } = {}): CompareRow[] {
  const nk = (k: string) => (o.relaxed ? relaxKey(k) : k)
  const na = new Map<string, { key: string; v: string }>(), nb = new Map<string, { key: string; v: string }>()
  for (const [k, v] of a) na.set(nk(k), { key: k, v })
  for (const [k, v] of b) nb.set(nk(k), { key: k, v })
  const norm = (v: string) => { let x = v; if (o.trimValues) x = x.trim(); if (o.ignoreValueCase) x = x.toLowerCase(); return x }
  const keys = [...new Set([...na.keys(), ...nb.keys()])].sort()
  return keys.map((k) => {
    const l = na.get(k), r = nb.get(k)
    const key = l?.key ?? r!.key
    if (l && !r) return { key, status: 'removed' as Status, left: l.v }
    if (!l && r) return { key, status: 'added' as Status, right: r.v }
    return { key: l!.key === r!.key ? key : `${l!.key} ≈ ${r!.key}`, status: (norm(l!.v) === norm(r!.v) ? 'unchanged' : 'modified') as Status, left: l!.v, right: r!.v }
  })
}
export const countStatus = (rows: CompareRow[]) => ({
  added: rows.filter((r) => r.status === 'added').length, removed: rows.filter((r) => r.status === 'removed').length,
  modified: rows.filter((r) => r.status === 'modified').length, unchanged: rows.filter((r) => r.status === 'unchanged').length,
})
export function compareToCsv(rows: CompareRow[], mask: boolean) {
  const e = (s = '') => `"${s.replace(/"/g, '""')}"`
  const m = (k: string, v?: string) => (mask && v !== undefined && isSensitiveKey(k) ? maskValue(v) : v)
  return ['key,status,left,right', ...rows.map((r) => [e(r.key), r.status, e(m(r.key, r.left)), e(m(r.key, r.right))].join(','))].join('\n')
}
export function compareToMarkdown(rows: CompareRow[], mask: boolean) {
  const m = (k: string, v?: string) => (v === undefined ? '' : (mask && isSensitiveKey(k) ? maskValue(v) : v).replace(/\|/g, '\\|'))
  return ['| Key | Status | Left | Right |', '|---|---|---|---|', ...rows.map((r) => `| ${r.key} | ${r.status} | ${m(r.key, r.left)} | ${m(r.key, r.right)} |`)].join('\n')
}
