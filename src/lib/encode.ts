const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true })

export function bytesToB64(b: Uint8Array, urlSafe = false, pad = true): string {
  let s = ''; const CH = 0x8000
  for (let i = 0; i < b.length; i += CH) s += String.fromCharCode(...b.subarray(i, i + CH))
  let r = btoa(s)
  if (urlSafe) r = r.replace(/\+/g, '-').replace(/\//g, '_')
  return pad ? r : r.replace(/=+$/, '')
}
export function b64ToBytes(input: string): Uint8Array {
  let s = input.trim().replace(/\s+/g, '')
  if (/[-_]/.test(s) && !/[+/]/.test(s)) s = s.replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) { const bad = /[^A-Za-z0-9+/=]/.exec(s); throw new Error(bad ? `Invalid Base64 character “${bad[0]}” at position ${bad.index + 1}.` : 'Invalid Base64 padding.') }
  if (s.length % 4 === 1) throw new Error('Invalid Base64 length (a single trailing character cannot be decoded).')
  s = s.replace(/=+$/, ''); s += '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s); const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
export const b64encodeText = (t: string, urlSafe = false, pad = true) => bytesToB64(enc.encode(t), urlSafe, pad)
export function b64decodeText(s: string): string {
  const bytes = b64ToBytes(s)
  try { return dec.decode(bytes) } catch { throw new Error('Decoded bytes are not valid UTF-8 text (this may be binary data — use the Base64 → Hex tool).') }
}
export function bytesToHex(b: Uint8Array, sep = '', upper = false): string { const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(sep); return upper ? h.toUpperCase() : h }
export function hexToBytes(input: string): Uint8Array {
  const s = input.trim().replace(/^0x/i, '').replace(/[\s:,-]|0x/gi, '')
  if (!s) return new Uint8Array()
  if (!/^[0-9a-fA-F]*$/.test(s)) { const bad = /[^0-9a-fA-F]/.exec(s)!; throw new Error(`Invalid hex character “${bad[0]}”.`) }
  if (s.length % 2) throw new Error('Hex string must have an even number of digits.')
  const out = new Uint8Array(s.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16)
  return out
}
export const utf8 = (t: string) => enc.encode(t)

export type UrlMode = 'component' | 'full' | 'form'
export function urlEncode(s: string, mode: UrlMode = 'component'): string {
  if (mode === 'full') return encodeURI(s)
  const r = encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  return mode === 'form' ? r.replace(/%20/g, '+') : r
}
export function urlDecode(s: string, mode: UrlMode = 'component'): string {
  try { return mode === 'full' ? decodeURI(s) : decodeURIComponent(mode === 'form' ? s.replace(/\+/g, ' ') : s) } catch { throw new Error('Malformed percent-encoding (e.g. a stray “%” or invalid UTF-8 sequence).') }
}

const NAMED: Record<string, string> = { '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos', '\u00a0': 'nbsp', '©': 'copy', '®': 'reg', '™': 'trade', '€': 'euro', '£': 'pound', '¥': 'yen', '¢': 'cent', '§': 'sect', '°': 'deg', '±': 'plusmn', '×': 'times', '÷': 'divide', '«': 'laquo', '»': 'raquo', '…': 'hellip', '–': 'ndash', '—': 'mdash', '‘': 'lsquo', '’': 'rsquo', '“': 'ldquo', '”': 'rdquo', '•': 'bull', '←': 'larr', '→': 'rarr', '↑': 'uarr', '↓': 'darr', 'é': 'eacute', 'è': 'egrave', 'ü': 'uuml', 'ö': 'ouml', 'ä': 'auml', 'ñ': 'ntilde', 'ç': 'ccedil', 'ß': 'szlig' }
export function htmlEncode(s: string, o: { nonAscii?: 'none' | 'named' | 'decimal' | 'hex'; quotes?: boolean } = {}): string {
  let out = ''
  for (const ch of s) {
    const cp = ch.codePointAt(0)!
    if (ch === '&' || ch === '<' || ch === '>') out += `&${NAMED[ch]};`
    else if ((ch === '"' || ch === "'") && o.quotes !== false) out += ch === '"' ? '&quot;' : '&#39;'
    else if (cp > 126 && o.nonAscii && o.nonAscii !== 'none') out += o.nonAscii === 'named' && NAMED[ch] ? `&${NAMED[ch]};` : o.nonAscii === 'hex' ? `&#x${cp.toString(16).toUpperCase()};` : `&#${cp};`
    else out += ch
  }
  return out
}
export function htmlDecode(s: string): string {
  const t = document.createElement('textarea') // textarea never executes markup
  t.innerHTML = s.replace(/</g, '&lt;')
  return t.value
}

// ---- JWT ----
export interface Jwt { header: Record<string, unknown>; payload: Record<string, unknown> | unknown; signature: string; parts: string[] }
export function decodeJwt(token: string): Jwt {
  const t = token.trim().replace(/^bearer\s+/i, '')
  const parts = t.split('.')
  if (parts.length !== 3) throw new Error(`A JWT has 3 dot-separated parts (header.payload.signature) — found ${parts.length}.`)
  const j = (p: string, n: string) => { try { return JSON.parse(b64decodeText(p)) } catch (e) { throw new Error(`Could not decode ${n}: ${(e as Error).message}`) } }
  return { header: j(parts[0], 'header'), payload: j(parts[1], 'payload'), signature: parts[2], parts }
}
