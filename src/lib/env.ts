export interface EnvEntry { key: string; value: string; line: number; quoted: '"' | "'" | ''; comment?: string; exported: boolean }
export interface EnvResult { entries: EnvEntry[]; errors: { line: number; message: string }[]; warnings: { line: number; message: string }[] }

export function parseEnv(text: string): EnvResult {
  const entries: EnvEntry[] = [], errors: EnvResult['errors'] = [], warnings: EnvResult['warnings'] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const seen = new Map<string, number>()
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], t = raw.trim()
    if (!t || t[0] === '#') continue
    const m = /^(export\s+)?([^=\s]+)\s*=\s*(.*)$/.exec(t)
    if (!m) { errors.push({ line: i + 1, message: `Expected KEY=VALUE but found “${t.length > 40 ? t.slice(0, 40) + '…' : t}”` }); continue }
    const key = m[2]
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(key)) warnings.push({ line: i + 1, message: `Unusual variable name “${key}” (expected letters, digits and underscores)` })
    let rest = m[3], value = '', quoted: EnvEntry['quoted'] = '', comment: string | undefined
    const q = rest[0]
    if (q === '"' || q === "'") {
      quoted = q
      let buf = rest.slice(1), startLine = i
      let end = -1
      for (;;) {
        for (let k = 0; k < buf.length; k++) { if (buf[k] === '\\' && q === '"') { k++; continue } if (buf[k] === q) { end = k; break } }
        if (end >= 0) break
        if (++i >= lines.length) { errors.push({ line: startLine + 1, message: `Unterminated ${q} quote for ${key}` }); break }
        buf += '\n' + lines[i]
      }
      if (end < 0) continue
      value = buf.slice(0, end)
      if (q === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\(["\\$])/g, '$1')
      const after = buf.slice(end + 1).trim()
      if (after.startsWith('#')) comment = after.slice(1).trim()
      else if (after) warnings.push({ line: startLine + 1, message: `Unexpected text after closing quote for ${key}` })
      lines[startLine] = lines[startLine]
    } else {
      const c = /\s#/.exec(rest)
      if (c) { comment = rest.slice(c.index + 2).trim(); rest = rest.slice(0, c.index) }
      value = rest.trim()
    }
    if (seen.has(key)) warnings.push({ line: i + 1, message: `Duplicate variable ${key} (first defined on line ${seen.get(key)}); the last value wins` })
    seen.set(key, i + 1)
    entries.push({ key, value, line: i + 1, quoted, comment, exported: !!m[1] })
  }
  return { entries, errors, warnings }
}
export function envToMap(text: string): Map<string, string> {
  const r = parseEnv(text)
  if (r.errors.length) throw new Error(r.errors.map((e) => `Line ${e.line}: ${e.message}`).join('\n'))
  return new Map(r.entries.map((e) => [e.key, e.value]))
}
const needsQuote = (v: string) => v === '' ? false : /[\s#"'\\$`]/.test(v) || v.includes('\n')
export function formatEnv(text: string, o: { sort?: boolean; align?: boolean; quote?: 'minimal' | 'always' | 'preserve'; dropComments?: boolean } = {}): string {
  const r = parseEnv(text)
  if (r.errors.length) throw new Error(r.errors.map((e) => `Line ${e.line}: ${e.message}`).join('\n'))
  const map = new Map<string, EnvEntry>(); r.entries.forEach((e) => map.set(e.key, e))
  let list = [...map.values()]
  if (o.sort) list = list.sort((a, b) => a.key.localeCompare(b.key))
  const w = o.align ? Math.max(0, ...list.map((e) => e.key.length)) : 0
  return list.map((e) => {
    const q = o.quote === 'always' ? '"' : o.quote === 'preserve' ? e.quoted : needsQuote(e.value) ? '"' : ''
    const v = q === '"' ? `"${e.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"` : q === "'" ? `'${e.value}'` : e.value
    return `${e.exported ? 'export ' : ''}${o.align ? e.key.padEnd(w) : e.key}=${v}${e.comment && !o.dropComments ? ` # ${e.comment}` : ''}`
  }).join('\n') + '\n'
}
