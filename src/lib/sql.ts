/** Remove comments and collapse whitespace outside string/identifier literals (literals are kept byte-for-byte). */
export function minifySql(sql: string): string {
  const segs: { lit: boolean; text: string }[] = []
  let cur = '', i = 0
  const n = sql.length
  const flush = () => { if (cur) { segs.push({ lit: false, text: cur }); cur = '' } }
  while (i < n) {
    const c = sql[i], d = sql[i + 1]
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < n) { if (sql[j] === '\\' && c !== '`') { j += 2; continue } if (sql[j] === c) { if (sql[j + 1] === c) { j += 2; continue } break } j++ }
      flush(); segs.push({ lit: true, text: sql.slice(i, j + 1) }); i = j + 1; continue
    }
    if (c === '-' && d === '-') { while (i < n && sql[i] !== '\n') i++; cur += ' '; continue }
    if (c === '/' && d === '*') { const e = sql.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; cur += ' '; continue }
    cur += c; i++
  }
  flush()
  const out = segs.map((s) => (s.lit ? s.text : s.text.replace(/\s+/g, ' ').replace(/\s*([,();])\s*/g, (_m, p) => (p === ',' ? ', ' : p === ';' ? '; ' : p)))).join('')
  return out.trim()
}

export type PlaceholderStyle = 'auto' | 'qmark' | 'colon' | 'dollar' | 'at' | 'braces' | 'mybatis'
export interface Param { name?: string; value: string }

export function formatSqlValue(raw: string): string {
  const v = raw.trim()
  if (/^null$/i.test(v)) return 'NULL'
  if (/^(true|false)$/i.test(v)) return v.toUpperCase()
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)) return v
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v
  return `'${raw.replace(/'/g, "''")}'`
}
/** Parse params from JSON array/object, key=value lines, Hibernate "binding parameter" logs, or one value per line. */
export function parseParams(text: string): { list: string[]; named: Map<string, string> } {
  const list: string[] = [], named = new Map<string, string>()
  const t = text.trim()
  if (!t) return { list, named }
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      const j = JSON.parse(t)
      if (Array.isArray(j)) j.forEach((x) => list.push(x === null ? 'null' : typeof x === 'object' ? JSON.stringify(x) : String(x)))
      else for (const [k, x] of Object.entries(j)) { const s = x === null ? 'null' : typeof x === 'object' ? JSON.stringify(x) : String(x); named.set(k, s); list.push(s) }
      return { list, named }
    } catch { /* fall through to line parsing */ }
  }
  for (const line of t.split(/\r?\n/)) {
    if (!line.trim()) continue
    const hb = /binding parameter\s*(?:\[(\d+)\])?.*?-\s*\[(.*)\]\s*$/i.exec(line) ?? /binding parameter\s*\[(\d+)\].*?as\s*\[\w+\]\s*-\s*\[(.*)\]/i.exec(line)
    if (hb) { list.push(hb[2]); continue }
    const kv = /^\s*([:@$#{]*[\w.]+\}?)\s*(?:=|=>|:)\s*(.*)$/.exec(line)
    if (kv && !/^\d+$/.test(kv[1]) === true && /[A-Za-z_]/.test(kv[1])) { const k = kv[1].replace(/^[:@$#{]+|\}$/g, ''); named.set(k, kv[2]); list.push(kv[2]); continue }
    const nk = /^\s*(\d+)\s*(?:=|=>)\s*(.*)$/.exec(line)
    if (nk) { named.set(nk[1], nk[2]); list[Number(nk[1]) - 1] = nk[2]; continue }
    list.push(line.trim())
  }
  return { list, named }
}

export function replaceSqlVariables(sql: string, paramsText: string, style: PlaceholderStyle = 'auto'): { sql: string; used: number; missing: string[]; unused: number } {
  const { list, named } = parseParams(paramsText)
  let out = '', i = 0, pos = 0, used = 0
  const missing: string[] = []
  const n = sql.length
  const st = style === 'auto' ? (/\$\{\w+\}/.test(sql) ? 'braces' : /#\{[\w.]+\}/.test(sql) ? 'mybatis' : /\$\d+/.test(sql) ? 'dollar' : /[:@][A-Za-z_]\w*/.test(sql.replace(/::\w+/g, '')) ? (/:[A-Za-z_]/.test(sql.replace(/::\w+/g, '')) ? 'colon' : 'at') : 'qmark') : style
  const take = (name?: string, idx?: number): string => {
    const v = name !== undefined && named.has(name) ? named.get(name) : idx !== undefined ? list[idx] : undefined
    if (v === undefined) { missing.push(name ?? `#${(idx ?? 0) + 1}`); return '' }
    used++; return formatSqlValue(v)
  }
  while (i < n) {
    const c = sql[i], d = sql[i + 1]
    if (c === "'" || c === '"' || c === '`') { let j = i + 1; while (j < n) { if (sql[j] === c) { if (sql[j + 1] === c) { j += 2; continue } break } j++ } out += sql.slice(i, j + 1); i = j + 1; continue }
    if (c === '-' && d === '-') { let j = i; while (j < n && sql[j] !== '\n') j++; out += sql.slice(i, j); i = j; continue }
    if (c === '/' && d === '*') { const e = sql.indexOf('*/', i + 2); const j = e < 0 ? n : e + 2; out += sql.slice(i, j); i = j; continue }
    if (st === 'qmark' && c === '?' ) { const r = take(undefined, pos++); out += r || '?'; i++; continue }
    if (st === 'colon' && c === ':' && d !== ':' && /[A-Za-z_]/.test(d ?? '') && !/[:\w]/.test(sql[i - 1] ?? '')) { const m = /^[A-Za-z_]\w*/.exec(sql.slice(i + 1))!; const r = take(m[0]); out += r || m[0] && `:${m[0]}`; i += 1 + m[0].length; continue }
    if (st === 'at' && c === '@' && /[A-Za-z_]/.test(d ?? '') && sql[i + 1] !== '@') { const m = /^[A-Za-z_]\w*/.exec(sql.slice(i + 1))!; const r = take(m[0]); out += r || `@${m[0]}`; i += 1 + m[0].length; continue }
    if (st === 'dollar' && c === '$' && /\d/.test(d ?? '')) { const m = /^\d+/.exec(sql.slice(i + 1))!; const r = take(m[0], Number(m[0]) - 1); out += r || `$${m[0]}`; i += 1 + m[0].length; continue }
    if (st === 'braces' && c === '$' && d === '{') { const e = sql.indexOf('}', i); if (e > 0) { const name = sql.slice(i + 2, e).trim(); const r = take(name); out += r || sql.slice(i, e + 1); i = e + 1; continue } }
    if (st === 'mybatis' && c === '#' && d === '{') { const e = sql.indexOf('}', i); if (e > 0) { const name = sql.slice(i + 2, e).split(',')[0].trim(); const r = take(name); out += r || sql.slice(i, e + 1); i = e + 1; continue } }
    out += c; i++
  }
  return { sql: out, used, missing, unused: Math.max(0, list.length - used) }
}
