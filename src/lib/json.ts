export class JsonError extends Error {
  line?: number; column?: number; position?: number
  constructor(msg: string, position?: number, text?: string) {
    super(msg)
    if (position != null && text != null) {
      this.position = position
      const before = text.slice(0, position).split('\n')
      this.line = before.length; this.column = before[before.length - 1].length + 1
    }
  }
}

/** Strict JSON scanner used only to locate the position of a syntax error (V8 messages no longer always include it). */
export function findJsonErrorPosition(t: string): { pos: number; msg: string } | null {
  let i = 0
  const fail = (msg: string, at = i): never => { throw Object.assign(new Error(msg), { at }) }
  const ws = () => { while (i < t.length && /[ \t\r\n]/.test(t[i])) i++ }
  const lit = (w: string) => { if (t.startsWith(w, i)) i += w.length; else fail(`Unexpected token “${t[i] ?? 'end of input'}”`) }
  const str = () => {
    i++
    while (i < t.length) {
      const c = t[i]
      if (c === '"') { i++; return }
      if (c === '\\') { const n = t[i + 1]; if (n === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(t.slice(i + 2, i + 6))) fail('Invalid unicode escape', i); i += 6 } else if ('"\\/bfnrt'.includes(n ?? '')) i += 2; else fail(`Invalid escape “\\${n ?? ''}”`, i); continue }
      if (c < ' ') fail('Unescaped control character in string')
      i++
    }
    fail('Unterminated string', t.length)
  }
  const val = (): void => {
    ws(); const c = t[i]
    if (c === '{') {
      i++; ws(); if (t[i] === '}') { i++; return }
      for (;;) { ws(); if (t[i] !== '"') fail('Expected a double-quoted property name'); str(); ws(); if (t[i] !== ':') fail("Expected ':' after property name"); i++; val(); ws(); if (t[i] === ',') { i++; continue } if (t[i] === '}') { i++; return } fail("Expected ',' or '}' after property value") }
    } else if (c === '[') {
      i++; ws(); if (t[i] === ']') { i++; return }
      for (;;) { val(); ws(); if (t[i] === ',') { i++; continue } if (t[i] === ']') { i++; return } fail("Expected ',' or ']' after array element") }
    } else if (c === '"') str()
    else if (c === 't') lit('true'); else if (c === 'f') lit('false'); else if (c === 'n') lit('null')
    else { const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(t.slice(i)); if (!m) fail(c === undefined ? 'Unexpected end of JSON input' : `Unexpected token “${c}”`); i += m![0].length }
  }
  try { val(); ws(); if (i < t.length) fail(`Unexpected content after the JSON value (“${t[i]}”)`); return null } catch (e) { return { pos: (e as { at?: number }).at ?? i, msg: (e as Error).message } }
}

export function parseJson(text: string): unknown {
  try { return JSON.parse(text) } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    const found = findJsonErrorPosition(text)
    const m = /position (\d+)/.exec(raw)
    const pos = found?.pos ?? (m ? Number(m[1]) : undefined)
    const err = new JsonError(raw, pos, text)
    if (pos !== undefined) {
      const detail = found?.msg ?? raw.replace(/ in JSON at position \d+.*/, '')
      const lines = text.split('\n'); const ln = lines[(err.line ?? 1) - 1] ?? ''
      const caret = ln.length > 80 ? '' : `\n${ln}\n${' '.repeat(Math.max(0, (err.column ?? 1) - 1))}^`
      err.message = `${detail} (line ${err.line}, column ${err.column})${caret}`
    }
    throw err
  }
}

export function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeysDeep((v as Record<string, unknown>)[k])]))
  return v
}
export function formatJson(text: string, indent: number | 'tab' = 2, sort = false): string {
  let v = parseJson(text); if (sort) v = sortKeysDeep(v)
  return JSON.stringify(v, null, indent === 'tab' ? '\t' : indent)
}
export const minifyJson = (text: string) => JSON.stringify(parseJson(text))

export function escapeJsonString(s: string): string { return JSON.stringify(s).slice(1, -1) }
/** Accepts either a quoted JSON string literal or its inner content. */
export function unescapeJsonString(s: string): string {
  const t = s.trim()
  const body = t.startsWith('"') && t.endsWith('"') && t.length >= 2 ? t : `"${t}"`
  try { const r = JSON.parse(body); if (typeof r !== 'string') throw new Error('not a string'); return r } catch (e) {
    throw new Error(`Invalid JSON string escape sequence: ${e instanceof Error ? e.message : e}`)
  }
}

export type JType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
export const typeOf = (v: unknown): JType => (v === null ? 'null' : Array.isArray(v) ? 'array' : (typeof v as JType))
const ident = /^[A-Za-z_$][\w$]*$/
export const pathKey = (p: string, k: string | number) => (typeof k === 'number' ? `${p}[${k}]` : ident.test(k) ? `${p}.${k}` : `${p}[${JSON.stringify(k)}]`)

// ---------------- diff ----------------
export type DiffKind = 'added' | 'removed' | 'modified' | 'typeChanged' | 'unchanged'
export interface DiffEntry { path: string; kind: DiffKind; left?: unknown; right?: unknown }
export interface DiffOptions { arrayMode?: 'index' | 'unordered'; includeUnchanged?: boolean }

const canon = (v: unknown): string => JSON.stringify(sortKeysDeep(v))

export function diffJson(a: unknown, b: unknown, opts: DiffOptions = {}): DiffEntry[] {
  const out: DiffEntry[] = []
  const walk = (x: unknown, y: unknown, p: string) => {
    const tx = typeOf(x), ty = typeOf(y)
    if (tx !== ty) { out.push({ path: p, kind: 'typeChanged', left: x, right: y }); return }
    if (tx === 'object') {
      const ox = x as Record<string, unknown>, oy = y as Record<string, unknown>
      for (const k of Object.keys(ox)) {
        const cp = pathKey(p, k)
        if (!(k in oy)) out.push({ path: cp, kind: 'removed', left: ox[k] })
        else walk(ox[k], oy[k], cp)
      }
      for (const k of Object.keys(oy)) if (!(k in ox)) out.push({ path: pathKey(p, k), kind: 'added', right: oy[k] })
      if (!Object.keys(ox).length && !Object.keys(oy).length && opts.includeUnchanged) out.push({ path: p, kind: 'unchanged', left: x, right: y })
    } else if (tx === 'array') {
      const ax = x as unknown[], ay = y as unknown[]
      if (opts.arrayMode === 'unordered') {
        const pool = new Map<string, number>()
        ay.forEach((v) => { const c = canon(v); pool.set(c, (pool.get(c) ?? 0) + 1) })
        const leftover: [number, unknown][] = []
        ax.forEach((v, i) => { const c = canon(v); const n = pool.get(c) ?? 0; if (n > 0) { pool.set(c, n - 1); if (opts.includeUnchanged) out.push({ path: pathKey(p, i), kind: 'unchanged', left: v, right: v }) } else leftover.push([i, v]) })
        const added: unknown[] = []
        ay.forEach((v) => { const c = canon(v); const n = pool.get(c) ?? 0; if (n > 0) { pool.set(c, n - 1); added.push(v) } })
        // pair leftovers positionally as modifications, rest as removed/added
        const n = Math.min(leftover.length, added.length)
        for (let i = 0; i < n; i++) walk(leftover[i][1], added[i], pathKey(p, leftover[i][0]))
        for (let i = n; i < leftover.length; i++) out.push({ path: pathKey(p, leftover[i][0]), kind: 'removed', left: leftover[i][1] })
        for (let i = n; i < added.length; i++) out.push({ path: `${p}[+]`, kind: 'added', right: added[i] })
      } else {
        const n = Math.max(ax.length, ay.length)
        for (let i = 0; i < n; i++) {
          if (i >= ay.length) out.push({ path: pathKey(p, i), kind: 'removed', left: ax[i] })
          else if (i >= ax.length) out.push({ path: pathKey(p, i), kind: 'added', right: ay[i] })
          else walk(ax[i], ay[i], pathKey(p, i))
        }
      }
    } else if (!Object.is(x, y)) out.push({ path: p, kind: 'modified', left: x, right: y })
    else if (opts.includeUnchanged) out.push({ path: p, kind: 'unchanged', left: x, right: y })
  }
  walk(a, b, '$')
  return out
}
export const diffCounts = (d: DiffEntry[]) => ({
  added: d.filter((x) => x.kind === 'added').length, removed: d.filter((x) => x.kind === 'removed').length,
  modified: d.filter((x) => x.kind === 'modified').length, typeChanged: d.filter((x) => x.kind === 'typeChanged').length,
})

// ---------------- stats ----------------
export interface JsonStats {
  totalNodes: number; maxDepth: number; types: Record<JType, number>; objects: number; arrays: number
  keys: number; uniqueKeys: number; topKeys: [string, number][]; largestArray: { path: string; length: number } | null
  longestString: { path: string; length: number } | null; avgArrayLength: number
  paths: { path: string; type: JType }[]
}
export function jsonStats(root: unknown, maxPaths = 5000): JsonStats {
  const types: Record<JType, number> = { object: 0, array: 0, string: 0, number: 0, boolean: 0, null: 0 }
  const keyCount = new Map<string, number>()
  let total = 0, maxDepth = 0, keys = 0, arrLens = 0
  let largest: JsonStats['largestArray'] = null, longest: JsonStats['longestString'] = null
  const paths: JsonStats['paths'] = []
  const stack: [unknown, string, number][] = [[root, '$', 0]]
  while (stack.length) {
    const [v, p, d] = stack.pop()!
    const t = typeOf(v); total++; types[t]++; maxDepth = Math.max(maxDepth, d)
    if (paths.length < maxPaths) paths.push({ path: p, type: t })
    if (t === 'array') {
      const a = v as unknown[]; arrLens += a.length
      if (!largest || a.length > largest.length) largest = { path: p, length: a.length }
      for (let i = a.length - 1; i >= 0; i--) stack.push([a[i], pathKey(p, i), d + 1])
    } else if (t === 'object') {
      const o = v as Record<string, unknown>
      for (const k of Object.keys(o)) { keys++; keyCount.set(k, (keyCount.get(k) ?? 0) + 1); stack.push([o[k], pathKey(p, k), d + 1]) }
    } else if (t === 'string' && (!longest || (v as string).length > longest.length)) longest = { path: p, length: (v as string).length }
  }
  return {
    totalNodes: total, maxDepth, types, objects: types.object, arrays: types.array, keys, uniqueKeys: keyCount.size,
    topKeys: [...keyCount].sort((a, b) => b[1] - a[1]).slice(0, 15), largestArray: largest, longestString: longest,
    avgArrayLength: types.array ? arrLens / types.array : 0, paths,
  }
}

/** Map of JSON-pointer → 1-based line number for each value in the text (best-effort, assumes valid JSON). */
export function pointerLines(text: string): Map<string, number> {
  const out = new Map<string, number>()
  let i = 0, line = 1
  const ws = () => { while (i < text.length && /\s/.test(text[i])) { if (text[i] === '\n') line++; i++ } }
  const str = () => { const s = i; i++; while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i++; i++ } i++; return JSON.parse(text.slice(s, i)) as string }
  const val = (ptr: string) => {
    ws(); out.set(ptr, line)
    const c = text[i]
    if (c === '{') {
      i++; ws()
      if (text[i] === '}') { i++; return }
      for (;;) { ws(); const k = str(); ws(); i++; val(`${ptr}/${String(k).replace(/~/g, '~0').replace(/\//g, '~1')}`); ws(); if (text[i] === ',') { i++; continue } i++; break }
    } else if (c === '[') {
      i++; ws()
      if (text[i] === ']') { i++; return }
      let n = 0
      for (;;) { val(`${ptr}/${n++}`); ws(); if (text[i] === ',') { i++; continue } i++; break }
    } else if (c === '"') str()
    else while (i < text.length && !/[\s,\]}]/.test(text[i])) i++
  }
  try { val('') } catch { /* ignore */ }
  return out
}
