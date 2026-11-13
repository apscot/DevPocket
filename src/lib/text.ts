import { words } from './shape'

// ---------- case ----------
export type CaseKind = 'camel' | 'pascal' | 'snake' | 'kebab' | 'constant' | 'sentence' | 'title' | 'lower' | 'upper' | 'dot' | 'path'
export const CASES: [CaseKind, string][] = [['camel', 'camelCase'], ['pascal', 'PascalCase'], ['snake', 'snake_case'], ['kebab', 'kebab-case'], ['constant', 'CONSTANT_CASE'], ['sentence', 'Sentence case'], ['title', 'Title Case'], ['lower', 'lower case'], ['upper', 'UPPER CASE'], ['dot', 'dot.case'], ['path', 'path/case']]
const SMALL = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in', 'with', 'as'])
export function convertCase(s: string, k: CaseKind): string {
  const w = words(s).map((x) => x.toLowerCase())
  if (!w.length) return ''
  const cap = (x: string) => x[0].toUpperCase() + x.slice(1)
  switch (k) {
    case 'camel': return w[0] + w.slice(1).map(cap).join('')
    case 'pascal': return w.map(cap).join('')
    case 'snake': return w.join('_')
    case 'kebab': return w.join('-')
    case 'constant': return w.join('_').toUpperCase()
    case 'dot': return w.join('.')
    case 'path': return w.join('/')
    case 'lower': return w.join(' ')
    case 'upper': return w.join(' ').toUpperCase()
    case 'sentence': return cap(w.join(' '))
    case 'title': return w.map((x, i) => (i > 0 && SMALL.has(x) ? x : cap(x))).join(' ')
  }
}

// ---------- toolbox ----------
export interface ToolboxOpts {
  normalize?: '' | 'NFC' | 'NFD' | 'NFKC' | 'NFKD'; stripAccents?: boolean; trimLines?: boolean; collapseSpaces?: boolean; removeBlank?: boolean; collapseBlank?: boolean
  caseMode?: '' | 'upper' | 'lower' | 'title' | 'sentence'; sort?: '' | 'asc' | 'desc' | 'natural' | 'length'; sortIgnoreCase?: boolean; unique?: boolean; reverse?: '' | 'lines' | 'chars' | 'words'
  numberLines?: boolean; prefix?: string; suffix?: string; join?: string; wrap?: number; tabsToSpaces?: number
}
export function textToolbox(input: string, o: ToolboxOpts): string {
  let t = input.replace(/\r\n?/g, '\n')
  if (o.normalize) t = t.normalize(o.normalize)
  if (o.stripAccents) t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (o.tabsToSpaces) t = t.replace(/\t/g, ' '.repeat(o.tabsToSpaces))
  let lines = t.split('\n')
  if (o.trimLines) lines = lines.map((l) => l.trim())
  if (o.collapseSpaces) lines = lines.map((l) => l.replace(/[ \t]{2,}/g, ' '))
  if (o.removeBlank) lines = lines.filter((l) => l.trim() !== '')
  else if (o.collapseBlank) lines = lines.filter((l, i) => !(l.trim() === '' && i > 0 && lines[i - 1].trim() === ''))
  if (o.caseMode) lines = lines.map((l) => (o.caseMode === 'upper' ? l.toUpperCase() : o.caseMode === 'lower' ? l.toLowerCase() : o.caseMode === 'title' ? l.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : l.toLowerCase().replace(/^\s*\p{L}/u, (c) => c.toUpperCase())))
  if (o.unique) { const seen = new Set<string>(); lines = lines.filter((l) => { const k = o.sortIgnoreCase ? l.toLowerCase() : l; if (seen.has(k)) return false; seen.add(k); return true }) }
  if (o.sort) {
    const key = (l: string) => (o.sortIgnoreCase ? l.toLowerCase() : l)
    lines = [...lines].sort(o.sort === 'length' ? (a, b) => a.length - b.length : o.sort === 'natural' ? (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: o.sortIgnoreCase ? 'base' : 'variant' }) : (a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
    if (o.sort === 'desc') lines.reverse()
  }
  if (o.reverse === 'lines') lines = [...lines].reverse()
  else if (o.reverse === 'chars') lines = lines.map((l) => [...l].reverse().join(''))
  else if (o.reverse === 'words') lines = lines.map((l) => l.split(/(\s+)/).reverse().join(''))
  if (o.wrap && o.wrap > 0) lines = lines.flatMap((l) => wrapLine(l, o.wrap!))
  if (o.numberLines) { const w = String(lines.length).length; lines = lines.map((l, i) => `${String(i + 1).padStart(w)}  ${l}`) }
  if (o.prefix || o.suffix) lines = lines.map((l) => `${o.prefix ?? ''}${l}${o.suffix ?? ''}`)
  return o.join !== undefined && o.join !== '' ? lines.join(o.join.replace(/\\n/g, '\n').replace(/\\t/g, '\t')) : lines.join('\n')
}
function wrapLine(l: string, w: number): string[] {
  if (l.length <= w) return [l]
  const out: string[] = []; let cur = ''
  for (const word of l.split(' ')) { if (cur && (cur + ' ' + word).length > w) { out.push(cur); cur = word } else cur = cur ? cur + ' ' + word : word }
  if (cur) out.push(cur); return out
}

// ---------- word stats ----------
export function wordStats(s: string) {
  const trimmed = s.trim()
  const words = trimmed ? (trimmed.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length : 0
  const sentences = trimmed ? (trimmed.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? []).filter((x) => /\p{L}|\p{N}/u.test(x)).length : 0
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0
  const freq = new Map<string, number>()
  for (const w of trimmed.toLowerCase().match(/[\p{L}\p{N}'’-]+/gu) ?? []) if (w.length > 2) freq.set(w, (freq.get(w) ?? 0) + 1)
  return { chars: [...s].length, charsNoSpaces: [...s.replace(/\s/g, '')].length, words, lines: s ? s.split(/\r\n|\r|\n/).length : 0, sentences, paragraphs, readMin: words / 238, speakMin: words / 150, top: [...freq].sort((a, b) => b[1] - a[1]).slice(0, 10) }
}

// ---------- invisible chars ----------
export const INVISIBLE: Record<number, [string, string]> = {
  0x00: ['NUL', 'Null'], 0x09: ['TAB', 'Tab'], 0x0b: ['VT', 'Vertical tab'], 0x0c: ['FF', 'Form feed'], 0x1b: ['ESC', 'Escape'], 0x7f: ['DEL', 'Delete'], 0xa0: ['NBSP', 'No-break space'], 0xad: ['SHY', 'Soft hyphen'],
  0x1680: ['OGSP', 'Ogham space'], 0x180e: ['MVS', 'Mongolian vowel separator'], 0x200b: ['ZWSP', 'Zero-width space'], 0x200c: ['ZWNJ', 'Zero-width non-joiner'], 0x200d: ['ZWJ', 'Zero-width joiner'], 0x200e: ['LRM', 'Left-to-right mark'], 0x200f: ['RLM', 'Right-to-left mark'],
  0x2028: ['LS', 'Line separator'], 0x2029: ['PS', 'Paragraph separator'], 0x202a: ['LRE', 'LTR embedding'], 0x202b: ['RLE', 'RTL embedding'], 0x202c: ['PDF', 'Pop directional'], 0x202d: ['LRO', 'LTR override'], 0x202e: ['RLO', 'RTL override'], 0x202f: ['NNBSP', 'Narrow no-break space'],
  0x205f: ['MMSP', 'Medium mathematical space'], 0x2060: ['WJ', 'Word joiner'], 0x2061: ['FA', 'Function application'], 0x2062: ['IT', 'Invisible times'], 0x2063: ['IS', 'Invisible separator'], 0x2064: ['IP', 'Invisible plus'], 0x2066: ['LRI', 'LTR isolate'], 0x2067: ['RLI', 'RTL isolate'], 0x2068: ['FSI', 'First strong isolate'], 0x2069: ['PDI', 'Pop directional isolate'],
  0x3000: ['IDSP', 'Ideographic space'], 0xfeff: ['BOM', 'Byte order mark / ZWNBSP'], 0xfffc: ['OBJ', 'Object replacement'],
}
for (let c = 0x2000; c <= 0x200a; c++) INVISIBLE[c] = ['SP' + (c - 0x1fff), 'Unicode space U+' + c.toString(16).toUpperCase()]
export interface InvisibleFinding { index: number; cp: number; name: string; label: string; line: number; col: number }
export function findInvisible(s: string): { found: InvisibleFinding[]; eol: { lf: number; crlf: number; cr: number }; trailing: number } {
  const found: InvisibleFinding[] = []; let line = 1, col = 1
  for (let i = 0; i < s.length; i++) {
    const cp = s.charCodeAt(i)
    if (cp === 10) { line++; col = 1; continue }
    if (cp === 13) { if (s[i + 1] !== '\n') { line++; col = 1 }; continue }
    const info = INVISIBLE[cp] ?? (cp < 32 ? ['C0', `Control U+${cp.toString(16).toUpperCase().padStart(4, '0')}`] : cp >= 0x80 && cp <= 0x9f ? ['C1', `Control U+${cp.toString(16).toUpperCase()}`] : undefined)
    if (info) found.push({ index: i, cp, label: info[0], name: info[1], line, col })
    col++
  }
  const crlf = (s.match(/\r\n/g) ?? []).length, cr = (s.match(/\r(?!\n)/g) ?? []).length, lf = (s.match(/(?<!\r)\n/g) ?? []).length
  return { found, eol: { lf, crlf, cr }, trailing: (s.match(/[ \t]+(?=\r?\n|$)/g) ?? []).length }
}
export function visualize(s: string): string {
  // Mark line endings first, then replace invisible characters with readable tags.
  const eol = s.replace(/\r\n/g, '␍␊\n').replace(/\r/g, '␍\n').replace(/(^|[^␊])\n/g, (_m, pre) => `${pre}␊\n`)
  return eol.replace(/[^\S\n]|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u00ad\u1680\u180e\u200b-\u200f\u2028-\u202f\u205f-\u2064\u2066-\u2069\u3000\ufeff\ufffc]/gu, (c) => {
    const cp = c.codePointAt(0)!
    if (c === ' ') return '·'
    if (c === '\t') return '→\t'
    if (c === '␍' || c === '␊') return c
    const i = INVISIBLE[cp]
    return i ? `⟦${i[0]}⟧` : `⟦U+${cp.toString(16).toUpperCase()}⟧`
  })
}
export function cleanInvisible(s: string, o: { keepNbsp?: boolean; normalizeSpaces?: boolean; normalizeEol?: 'lf' | 'crlf' | '' ; trimTrailing?: boolean } = {}): string {
  let t = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u00ad\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff\ufffc]/g, '')
  if (o.normalizeSpaces !== false) t = t.replace(o.keepNbsp ? /[\u1680\u2000-\u200a\u202f\u205f\u3000]/g : /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
  t = t.replace(/[\u2028\u2029]/g, '\n')
  if (o.normalizeEol === 'lf') t = t.replace(/\r\n?/g, '\n'); else if (o.normalizeEol === 'crlf') t = t.replace(/\r\n?|\n/g, '\r\n')
  if (o.trimTrailing) t = t.replace(/[ \t]+$/gm, '')
  return t
}
export function cleanClipboard(s: string, o: { stripHtml?: boolean; stripMarkdown?: boolean; straightQuotes?: boolean; collapseSpaces?: boolean; trimLines?: boolean; removeBlank?: boolean; collapseBlank?: boolean; removeInvisible?: boolean; joinLines?: boolean; stripBullets?: boolean; tabs?: boolean }): string {
  let t = s.replace(/\r\n?/g, '\n')
  if (o.stripHtml) t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  if (o.stripMarkdown) t = t.replace(/^#{1,6}\s+/gm, '').replace(/(\*\*|__)(.*?)\1/g, '$2').replace(/(\*|_)(.*?)\1/g, '$2').replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^>\s?/gm, '')
  if (o.removeInvisible) t = cleanInvisible(t, { normalizeSpaces: true })
  if (o.straightQuotes) t = t.replace(/[‘’‛]/g, "'").replace(/[“”„]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
  if (o.stripBullets) t = t.replace(/^\s*[•◦▪●○■□▶►\-*–]\s+/gm, '').replace(/^\s*\d+[.)]\s+/gm, '')
  if (o.tabs) t = t.replace(/\t/g, ' ')
  if (o.trimLines) t = t.split('\n').map((l) => l.trim()).join('\n')
  if (o.collapseSpaces) t = t.replace(/[ \t]{2,}/g, ' ')
  if (o.removeBlank) t = t.split('\n').filter((l) => l.trim()).join('\n'); else if (o.collapseBlank) t = t.replace(/\n{3,}/g, '\n\n')
  if (o.joinLines) t = t.replace(/\n(?!\n)/g, ' ')
  return t.trim()
}

// ---------- template ----------
export function parseKv(text: string): Record<string, string> {
  const t = text.trim(); if (!t) return {}
  if (t.startsWith('{')) { try { const o = JSON.parse(t); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])) } catch { /* fall through */ } }
  const out: Record<string, string> = {}
  for (const l of t.split(/\r?\n/)) { if (!l.trim() || /^\s*#/.test(l)) continue; const i = l.search(/[=:]/); if (i < 1) throw new Error(`Line “${l}” is not key=value`); out[l.slice(0, i).trim()] = l.slice(i + 1).trim() }
  return out
}
export type PhStyle = 'mustache' | 'dollar' | 'percent' | 'single' | 'angle'
const PH: Record<PhStyle, RegExp> = { mustache: /\{\{\s*([\w.-]+)\s*\}\}/g, dollar: /\$\{\s*([\w.-]+)\s*\}/g, percent: /%([\w.-]+)%/g, single: /\{([\w.-]+)\}/g, angle: /<([\w.-]+)>/g }
export function fillTemplate(tpl: string, vars: Record<string, string>, style: PhStyle, missing: 'keep' | 'empty' | 'error' = 'keep') {
  const miss = new Set<string>(), used = new Set<string>()
  const out = tpl.replace(PH[style], (m, k: string) => { if (k in vars) { used.add(k); return vars[k] } miss.add(k); return missing === 'empty' ? '' : m })
  if (missing === 'error' && miss.size) throw new Error(`Missing values for: ${[...miss].join(', ')}`)
  return { out, missing: [...miss], unused: Object.keys(vars).filter((k) => !used.has(k)), count: used.size + miss.size }
}
export function placeholders(tpl: string, style: PhStyle): string[] { return [...new Set([...tpl.matchAll(PH[style])].map((m) => m[1]))] }

// ---------- dedupe ----------
export function dedupeLines(input: string, o: { ignoreCase?: boolean; trim?: boolean; keepEmpty?: boolean; sort?: '' | 'asc' | 'desc'; onlyDuplicates?: boolean; counts?: boolean }) {
  const lines = input.replace(/\r\n?/g, '\n').split('\n')
  const key = (l: string) => { let k = o.trim ? l.trim() : l; if (o.ignoreCase) k = k.toLowerCase(); return k }
  const count = new Map<string, number>(); const first = new Map<string, string>()
  for (const l of lines) { if (!o.keepEmpty && l.trim() === '') continue; const k = key(l); count.set(k, (count.get(k) ?? 0) + 1); if (!first.has(k)) first.set(k, o.trim ? l.trim() : l) }
  let out = [...first.entries()].filter(([k]) => !o.onlyDuplicates || count.get(k)! > 1).map(([k, v]) => ({ v, n: count.get(k)! }))
  if (o.sort) { out.sort((a, b) => a.v.localeCompare(b.v, undefined, { numeric: true })); if (o.sort === 'desc') out.reverse() }
  const total = lines.filter((l) => o.keepEmpty || l.trim() !== '').length
  return { text: out.map((x) => (o.counts ? `${x.n}\t${x.v}` : x.v)).join('\n'), removed: total - first.size, unique: first.size, total }
}

// ---------- markdown table ----------
export function toMarkdownTable(rows: string[][], o: { header?: boolean; align?: ('l' | 'c' | 'r')[]; pretty?: boolean }): string {
  if (!rows.length) return ''
  const cols = Math.max(...rows.map((r) => r.length))
  const norm = rows.map((r) => Array.from({ length: cols }, (_, i) => (r[i] ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim()))
  const header = o.header === false ? Array.from({ length: cols }, (_, i) => `Column ${i + 1}`) : norm[0]
  const body = o.header === false ? norm : norm.slice(1)
  const al = (i: number) => o.align?.[i] ?? 'l'
  const widths = Array.from({ length: cols }, (_, i) => (o.pretty === false ? 3 : Math.max(3, ...[header, ...body].map((r) => [...r[i]].length))))
  const pad = (s: string, i: number) => (o.pretty === false ? s : al(i) === 'r' ? s.padStart(widths[i]) : al(i) === 'c' ? s.padStart(Math.floor((widths[i] + [...s].length) / 2)).padEnd(widths[i]) : s.padEnd(widths[i]))
  const sep = widths.map((w, i) => (al(i) === 'c' ? ':' + '-'.repeat(w - 2) + ':' : al(i) === 'r' ? '-'.repeat(w - 1) + ':' : ':' + '-'.repeat(w - 1)))
  const line = (r: string[]) => '| ' + r.map(pad).join(' | ') + ' |'
  return [line(header), '| ' + sep.join(' | ') + ' |', ...body.map(line)].join('\n')
}

// ---------- ascii tree ----------
interface TNode { name: string; children: Map<string, TNode>; dir: boolean }
export function asciiTree(input: string, o: { style?: 'unicode' | 'ascii'; root?: string; exclude?: string; sort?: boolean; dirsFirst?: boolean; maxDepth?: number; slash?: boolean }): string {
  const lines = input.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim())
  if (!lines.length) return ''
  const root: TNode = { name: o.root || '.', children: new Map(), dir: true }
  const excl = (o.exclude ?? '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean).map((p) => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'))
  const skip = (n: string) => excl.some((r) => r.test(n))
  const add = (parts: string[], dirLast: boolean) => {
    let cur = root
    for (let i = 0; i < parts.length; i++) { const p = parts[i]; if (skip(p) || i >= (o.maxDepth ?? 99)) break; let ch = cur.children.get(p); if (!ch) { ch = { name: p, children: new Map(), dir: i < parts.length - 1 || dirLast }; cur.children.set(p, ch) } if (i < parts.length - 1) ch.dir = true; cur = ch }
  }
  const indented = lines.some((l) => /^\s+\S/.test(l)) && !lines.some((l) => /[/\\]/.test(l.trim()) && !/^\s/.test(l))
  if (indented) {
    const stack: { indent: number; parts: string[] }[] = []
    for (const l of lines) {
      const indent = l.match(/^[\s│├└─|`'\-+]*/)![0].length; const name = l.replace(/^[\s│├└─|`'\-+]*/, '').replace(/\/$/, '')
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
      const parts = [...(stack.length ? stack[stack.length - 1].parts : []), name]
      stack.push({ indent, parts }); add(parts, l.trim().endsWith('/'))
    }
  } else for (const l of lines) { const clean = l.trim().replace(/^\.?\//, '').replace(/\\/g, '/'); add(clean.split('/').filter(Boolean), clean.endsWith('/')) }
  const u = o.style !== 'ascii'
  const [T, L, V, S] = u ? ['├── ', '└── ', '│   ', '    '] : ['|-- ', '`-- ', '|   ', '    ']
  const out = [root.name + (o.slash !== false && root.name !== '.' ? '/' : '')]
  const walk = (n: TNode, prefix: string) => {
    let kids = [...n.children.values()]
    if (o.sort !== false) kids.sort((a, b) => a.name.localeCompare(b.name))
    if (o.dirsFirst) kids = [...kids.filter((k) => k.dir || k.children.size), ...kids.filter((k) => !(k.dir || k.children.size))]
    kids.forEach((k, i) => { const last = i === kids.length - 1; out.push(prefix + (last ? L : T) + k.name + ((k.dir || k.children.size) && o.slash !== false ? '/' : '')); walk(k, prefix + (last ? S : V)) })
  }
  walk(root, '')
  return out.join('\n')
}
