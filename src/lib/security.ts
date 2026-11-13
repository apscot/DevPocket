// ---------- Password generator ----------
export const SETS = { lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~' }
export function secureInt(max: number): number {
  if (max <= 0 || max > 0xffffffff) throw new Error('Range error')
  const lim = Math.floor(0x100000000 / max) * max; const a = new Uint32Array(1)
  do { crypto.getRandomValues(a) } while (a[0] >= lim) // rejection sampling → no modulo bias
  return a[0] % max
}
export interface PwOpts { length: number; lower: boolean; upper: boolean; digits: boolean; symbols: boolean; excludeAmbiguous?: boolean; exclude?: string; custom?: string }
export function generatePassword(o: PwOpts): string {
  const clean = (s: string) => [...new Set([...s])].filter((c) => !(o.excludeAmbiguous && /[Il1O0o|`'"]/.test(c)) && !(o.exclude ?? '').includes(c)).join('')
  const sets = (['lower', 'upper', 'digits', 'symbols'] as const).filter((k) => o[k]).map((k) => clean(SETS[k])).filter(Boolean)
  if (o.custom) { const c = clean(o.custom); if (c) sets.push(c) }
  if (!sets.length) throw new Error('Select at least one character set.')
  if (o.length < sets.length) throw new Error(`Length must be at least ${sets.length} to include every selected set.`)
  if (o.length > 512) throw new Error('Maximum length is 512.')
  const pool = sets.join('')
  const chars: string[] = sets.map((s) => s[secureInt(s.length)])
  while (chars.length < o.length) chars.push(pool[secureInt(pool.length)])
  for (let i = chars.length - 1; i > 0; i--) { const j = secureInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]] }
  return chars.join('')
}
export const entropyBits = (len: number, poolSize: number) => Math.round(len * Math.log2(Math.max(poolSize, 1)))

// ---------- Hashing ----------
export type HashAlg = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
export async function digest(alg: HashAlg, data: BufferSource): Promise<Uint8Array> { return new Uint8Array(await crypto.subtle.digest(alg, data)) }
export async function hmacSign(alg: HashAlg, key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: alg }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data as BufferSource))
}
export async function hmacVerify(alg: HashAlg, key: Uint8Array, data: Uint8Array, sig: Uint8Array): Promise<boolean> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: alg }, false, ['verify'])
  return crypto.subtle.verify('HMAC', k, sig as BufferSource, data as BufferSource)
}

// ---------- Secret detection ----------
export interface SecretRule { id: string; label: string; re: RegExp; group?: number; enabled?: boolean }
const kv = String.raw`(?:pass(?:word|wd)?|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|auth(?:orization)?|credential[s]?|client[_-]?secret|private[_-]?key)`
export const BUILTIN_RULES: SecretRule[] = [
  { id: 'private-key', label: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { id: 'aws-access', label: 'AWS access key ID', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'github', label: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/g },
  { id: 'slack', label: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: 'stripe', label: 'Stripe key', re: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { id: 'google', label: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'jwt', label: 'JWT', re: /\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*\b/g },
  { id: 'bearer', label: 'Bearer token', re: /\bBearer\s+([A-Za-z0-9._~+/=-]{12,})/gi, group: 1 },
  { id: 'basic-auth-url', label: 'Credentials in URL', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:([^\s@/]+)@/gi, group: 1 },
  { id: 'assignment', label: 'Secret assignment', re: new RegExp(String.raw`(?:["']?[\w.-]*${kv}[\w.-]*["']?)[ \t]*[:=][ \t]*(?:"([^"\n]+)"|'([^'\n]+)'|([^\s,;"'}&]+))`, 'gi'), group: -1 },
  { id: 'email', label: 'Email address', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, enabled: false },
  { id: 'ipv4', label: 'IPv4 address', re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, enabled: false },
]
export interface Finding { rule: string; label: string; start: number; end: number; value: string; line: number }
export function detectSecrets(text: string, rules: SecretRule[], custom: string[] = []): Finding[] {
  const all: SecretRule[] = [...rules, ...custom.filter(Boolean).flatMap((p, i) => { try { return [{ id: `custom-${i}`, label: `Custom: ${p}`, re: new RegExp(p, 'g') }] } catch { throw new Error(`Invalid custom regex: ${p}`) } })]
  const found: Finding[] = []
  for (const r of all) {
    const re = new RegExp(r.re.source, r.re.flags.includes('g') ? r.re.flags : r.re.flags + 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      if (m[0] === '') { re.lastIndex++; continue }
      let value = m[0], start = m.index
      if (r.group) {
        const g = r.group === -1 ? [m[1], m[2], m[3]].find((x) => x !== undefined) : m[r.group]
        if (g === undefined) continue
        start = m.index + m[0].lastIndexOf(g); value = g
      }
            if (r.id === 'assignment' && /^(true|false|null|undefined|\*+|•+|\[?redacted\]?|<.*|\$\{.*|\{\{.*|%\(.*)$/i.test(value)) continue
      found.push({ rule: r.id, label: r.label, start, end: start + value.length, value, line: text.slice(0, start).split('\n').length })
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: Finding[] = []
  for (const f of found) { const l = merged[merged.length - 1]; if (l && f.start < l.end) { if (f.end > l.end && f.start === l.start) merged[merged.length - 1] = f; continue } merged.push(f) }
  return merged
}
export type RedactStyle = 'label' | 'stars' | 'partial' | 'fixed'
export function redact(text: string, findings: Finding[], style: RedactStyle = 'label'): string {
  let out = '', last = 0
  for (const f of findings) {
    out += text.slice(last, f.start)
    out += style === 'label' ? `[REDACTED:${f.rule}]` : style === 'stars' ? '*'.repeat(Math.min(f.value.length, 32)) : style === 'partial' ? (f.value.length > 8 ? f.value.slice(0, 2) + '*'.repeat(Math.min(f.value.length - 4, 20)) + f.value.slice(-2) : '*'.repeat(f.value.length)) : '[REDACTED]'
    last = f.end
  }
  return out + text.slice(last)
}
