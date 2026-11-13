import { typeOf } from './json'

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).filter(Boolean)
  const cands = [',', ';', '\t', '|']
  let best = ',', bestScore = -1
  for (const d of cands) {
    const counts = sample.map((l) => parseCsv(l, d)[0]?.length ?? 0)
    if (!counts.length || counts[0] < 2) continue
    const consistent = counts.every((c) => c === counts[0])
    const score = counts[0] + (consistent ? 100 : 0)
    if (score > bestScore) { best = d; bestScore = score }
  }
  return best
}

/** RFC 4180 compliant parser (quoted fields, escaped quotes, embedded newlines, CRLF). */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQ = false, i = 0
  const src = text.replace(/^\ufeff/, '')
  while (i < src.length) {
    const c = src[i]
    if (inQ) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i += 2; continue } inQ = false; i++; continue }
      field += c; i++; continue
    }
    if (c === '"' && field === '') { inQ = true; i++; continue }
    if (c === delimiter) { row.push(field); field = ''; i++; continue }
    if (c === '\r' || c === '\n') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''; rows.push(row); row = []; i++; continue
    }
    field += c; i++
  }
  if (inQ) throw new Error('Unterminated quoted field: a quote was opened but never closed.')
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

export function stringifyCsv(rows: unknown[][], delimiter = ','): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return s.includes(delimiter) || /["\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(esc).join(delimiter)).join('\n')
}

export function flattenObject(v: unknown, sep = '.', prefix = '', out: Record<string, unknown> = {}, arrays: 'index' | 'json' = 'index'): Record<string, unknown> {
  const t = typeOf(v)
  const join = (k: string | number) => (prefix ? prefix + sep + k : String(k))
  if (t === 'object' && Object.keys(v as object).length) {
    for (const [k, x] of Object.entries(v as object)) flattenObject(x, sep, join(k), out, arrays)
  } else if (t === 'array' && arrays === 'index' && (v as unknown[]).length) {
    (v as unknown[]).forEach((x, i) => flattenObject(x, sep, join(i), out, arrays))
  } else out[prefix || 'value'] = t === 'object' ? '{}' : t === 'array' ? JSON.stringify(v) : v
  return out
}

export interface J2CsvOpts { delimiter?: string; flatten?: boolean; separator?: string; arrays?: 'index' | 'json'; header?: boolean }
export function jsonToCsv(data: unknown, o: J2CsvOpts = {}): string {
  const rows = Array.isArray(data) ? data : [data]
  if (!rows.length) return ''
  const sep = o.separator ?? '.'
  const flat = rows.map((r) => {
    if (r && typeof r === 'object' && !Array.isArray(r)) {
      return o.flatten === false ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v && typeof v === 'object' ? JSON.stringify(v) : v])) : flattenObject(r, sep, '', {}, o.arrays ?? 'json')
    }
    return { value: r && typeof r === 'object' ? JSON.stringify(r) : r }
  })
  const headers: string[] = []; const seen = new Set<string>()
  for (const r of flat) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); headers.push(k) }
  const body = flat.map((r) => headers.map((h) => (r as Record<string, unknown>)[h]))
  return stringifyCsv(o.header === false ? body : [headers, ...body], o.delimiter ?? ',')
}

export function inferValue(s: string): unknown {
  const t = s.trim()
  if (t === '') return ''
  if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true'
  if (/^null$/i.test(t)) return null
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(t) && Number.isSafeInteger(Number(t)) || /^-?(0|[1-9]\d*)\.\d+$/.test(t)) return Number(t)
  return s
}
export interface Csv2JsonOpts { delimiter?: string; header?: boolean; infer?: boolean; trim?: boolean }
export function csvToJson(text: string, o: Csv2JsonOpts = {}): unknown[] {
  const d = o.delimiter && o.delimiter !== 'auto' ? o.delimiter : detectDelimiter(text)
  const rows = parseCsv(text, d)
  if (!rows.length) return []
  const hasHeader = o.header !== false
  const headers = hasHeader ? rows[0].map((h, i) => (h.trim() || `column${i + 1}`)) : rows[0].map((_, i) => `column${i + 1}`)
  const body = hasHeader ? rows.slice(1) : rows
  return body.map((r, ri) => {
    if (r.length > headers.length) throw new Error(`Row ${ri + (hasHeader ? 2 : 1)} has ${r.length} fields but the header has ${headers.length}.`)
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => { const raw = r[i] ?? ''; const v = o.trim ? raw.trim() : raw; obj[h] = o.infer === false ? v : inferValue(v) })
    return obj
  })
}

export interface SqlOpts { table?: string; columns?: string[]; header?: boolean; delimiter?: string; nullEmpty?: boolean; infer?: boolean; batch?: boolean; quote?: 'none' | 'ansi' | 'backtick' | 'bracket'; createTable?: boolean }
export const sqlQuote = (id: string, q: SqlOpts['quote']) => (q === 'ansi' ? `"${id.replace(/"/g, '""')}"` : q === 'backtick' ? '`' + id.replace(/`/g, '``') + '`' : q === 'bracket' ? `[${id}]` : id)
export function sqlLiteral(raw: string, o: SqlOpts): string {
  if (o.nullEmpty !== false && (raw === '' || /^null$/i.test(raw))) return 'NULL'
  if (o.infer !== false) {
    if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(raw.trim())) return raw.trim()
    if (/^(true|false)$/i.test(raw.trim())) return raw.trim().toUpperCase()
  }
  return `'${raw.replace(/'/g, "''")}'`
}
export function csvToSql(text: string, o: SqlOpts = {}): string {
  const d = o.delimiter && o.delimiter !== 'auto' ? o.delimiter : detectDelimiter(text)
  const rows = parseCsv(text, d)
  if (!rows.length) throw new Error('No CSV rows found.')
  const hasHeader = o.header !== false
  const cols = o.columns?.length ? o.columns : hasHeader ? rows[0].map((h) => h.trim()) : rows[0].map((_, i) => `column${i + 1}`)
  const body = hasHeader ? rows.slice(1) : rows
  if (!body.length) throw new Error('CSV has a header but no data rows.')
  const table = sqlQuote(o.table || 'my_table', o.quote)
  const colList = cols.map((c) => sqlQuote(c, o.quote)).join(', ')
  const vals = body.map((r, i) => {
    if (r.length > cols.length) throw new Error(`Row ${i + 1} has ${r.length} values for ${cols.length} columns.`)
    return '(' + cols.map((_, j) => sqlLiteral(r[j] ?? '', o)).join(', ') + ')'
  })
  let out = ''
  if (o.createTable) out += `CREATE TABLE ${table} (\n${cols.map((c, j) => `  ${sqlQuote(c, o.quote)} ${columnType(body.map((r) => r[j] ?? ''))}`).join(',\n')}\n);\n\n`
  out += o.batch === false ? vals.map((v) => `INSERT INTO ${table} (${colList}) VALUES ${v};`).join('\n') : `INSERT INTO ${table} (${colList}) VALUES\n${vals.map((v) => '  ' + v).join(',\n')};`
  return out
}
function columnType(vs: string[]): string {
  const nn = vs.filter((v) => v !== '')
  if (nn.length && nn.every((v) => /^-?\d+$/.test(v))) return 'BIGINT'
  if (nn.length && nn.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return 'DECIMAL(18,4)'
  if (nn.length && nn.every((v) => /^(true|false)$/i.test(v))) return 'BOOLEAN'
  const max = Math.max(0, ...nn.map((v) => v.length))
  return max > 255 ? 'TEXT' : 'VARCHAR(255)'
}
