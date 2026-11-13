export interface HttpHeader { name: string; value: string; line: number }
export interface ParsedHttp { kind: 'request' | 'response' | 'unknown'; startLine?: string; headers: HttpHeader[]; errors: string[] }
export type Sev = 'error' | 'warn' | 'info' | 'ok'
export interface Finding { sev: Sev; header: string; message: string }

export function parseHeaders(text: string): ParsedHttp {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const headers: HttpHeader[] = [], errors: string[] = []
  let startLine: string | undefined, kind: ParsedHttp['kind'] = 'unknown'
  lines.forEach((raw, i) => {
    const l = raw.trimEnd()
    if (!l.trim()) return
    if (i === lines.findIndex((x) => x.trim())) {
      if (/^HTTP\/\d/i.test(l)) { startLine = l; kind = 'response'; return }
      if (/^[A-Z]+\s+\S+\s+HTTP\/\d/i.test(l)) { startLine = l; kind = 'request'; return }
    }
    if (/^\s/.test(raw) && headers.length) { headers[headers.length - 1].value += ' ' + l.trim(); return }
    const m = /^([^:\s]+)\s*:\s*(.*)$/.exec(l)
    if (!m) { errors.push(`Line ${i + 1}: “${l.slice(0, 50)}” is not a valid header (expected Name: value)`); return }
    headers.push({ name: m[1], value: m[2], line: i + 1 })
  })
  if (kind === 'unknown') {
    const names = headers.map((h) => h.name.toLowerCase())
    if (names.some((n) => ['host', 'user-agent', 'accept', 'authorization', 'cookie', 'origin', 'referer'].includes(n))) kind = 'request'
    else if (names.some((n) => ['server', 'set-cookie', 'etag', 'strict-transport-security', 'content-security-policy', 'access-control-allow-origin', 'last-modified', 'x-powered-by'].includes(n))) kind = 'response'
  }
  return { kind, startLine, headers, errors }
}

export const EXPLAIN: Record<string, string> = {
  'cache-control': 'Directives that control caching in browsers and shared caches.', 'content-type': 'Media type (and charset) of the message body.', 'content-length': 'Size of the body in bytes.',
  'content-encoding': 'Compression applied to the body (gzip, br, deflate).', 'transfer-encoding': 'How the body is framed for transfer (e.g. chunked).', 'etag': 'Validator identifying a specific version of a resource for conditional requests.',
  'last-modified': 'When the resource was last changed; used for conditional requests.', 'expires': 'Legacy absolute expiry time; overridden by Cache-Control: max-age.', 'vary': 'Request headers that influence the cached response selection.',
  'set-cookie': 'Instructs the client to store a cookie.', 'cookie': 'Cookies the client sends to the server.', 'authorization': 'Credentials to authenticate the client (Basic, Bearer, …).',
  'www-authenticate': 'Challenge indicating how to authenticate.', 'host': 'Target host and port of the request.', 'user-agent': 'Identifies the client software.', 'accept': 'Media types the client can handle.',
  'accept-encoding': 'Compression algorithms the client supports.', 'accept-language': 'Preferred natural languages.', 'origin': 'Origin that initiated a cross-origin request.', 'referer': 'URL of the page that linked to this request.',
  'location': 'Redirect target or created-resource URL.', 'server': 'Software used by the origin server.', 'date': 'When the message was generated.', 'connection': 'Controls whether the connection stays open.',
  'strict-transport-security': 'HSTS: forces browsers to use HTTPS for this host.', 'content-security-policy': 'CSP: restricts which resources a page may load/execute (mitigates XSS).',
  'x-content-type-options': 'nosniff stops browsers from MIME-sniffing responses.', 'x-frame-options': 'Controls whether the page may be framed (clickjacking protection).',
  'referrer-policy': 'How much referrer information is sent with requests.', 'permissions-policy': 'Enables/disables browser features (camera, geolocation, …).',
  'access-control-allow-origin': 'CORS: origin(s) allowed to read the response.', 'access-control-allow-credentials': 'CORS: whether credentialed requests are allowed.',
  'access-control-allow-methods': 'CORS: methods allowed for cross-origin requests.', 'access-control-allow-headers': 'CORS: request headers allowed in cross-origin requests.',
  'access-control-expose-headers': 'CORS: response headers readable by scripts.', 'access-control-max-age': 'CORS: how long a preflight result may be cached.',
  'cross-origin-opener-policy': 'COOP: isolates the browsing context group.', 'cross-origin-embedder-policy': 'COEP: requires cross-origin resources to opt in.', 'cross-origin-resource-policy': 'CORP: who may load this resource cross-origin.',
  'x-xss-protection': 'Legacy XSS filter header; deprecated.', 'x-powered-by': 'Technology disclosure header (usually unnecessary).', 'pragma': 'HTTP/1.0 cache directive; superseded by Cache-Control.',
  'content-disposition': 'Suggests inline display or download and a filename.', 'range': 'Requests a part of a resource.', 'accept-ranges': 'Whether the server supports range requests.', 'if-none-match': 'Conditional request using an ETag.',
  'if-modified-since': 'Conditional request using a date.', 'x-forwarded-for': 'Original client IP behind proxies (spoofable).', 'x-request-id': 'Request correlation identifier.', 'retry-after': 'How long to wait before retrying.',
}

export function analyze(p: ParsedHttp): Finding[] {
  const f: Finding[] = []
  const get = (n: string) => p.headers.filter((h) => h.name.toLowerCase() === n)
  const one = (n: string) => get(n)[0]?.value
  const add = (sev: Sev, header: string, message: string) => f.push({ sev, header, message })
  const names = p.headers.map((h) => h.name.toLowerCase())
  const dup = names.filter((n, i) => names.indexOf(n) !== i && !['set-cookie', 'warning', 'link', 'vary'].includes(n))
  new Set(dup).forEach((d) => add('warn', d, 'Header appears more than once; behavior depends on the recipient.'))
  const cc = one('cache-control')
  if (cc !== undefined) {
    const d = cc.toLowerCase().split(',').map((x) => x.trim())
    const has = (x: string) => d.some((y) => y === x || y.startsWith(x + '='))
    const ma = /max-age=(\d+)/.exec(cc.toLowerCase())
    if (has('no-store')) add('ok', 'Cache-Control', 'no-store: response must not be stored by any cache (good for sensitive data).')
    else if (has('no-cache')) add('info', 'Cache-Control', 'no-cache: may be stored but must be revalidated before reuse.')
    if (has('public') && has('private')) add('error', 'Cache-Control', 'Both public and private are set — contradictory.')
    if (has('public') && p.kind === 'response' && (one('authorization') || get('set-cookie').length)) add('warn', 'Cache-Control', 'public on a response that sets cookies/auth may leak user-specific data via shared caches.')
    if (ma) add('info', 'Cache-Control', `max-age=${ma[1]} → fresh for ${humanSeconds(Number(ma[1]))}.`)
    if (has('immutable')) add('info', 'Cache-Control', 'immutable: content will not change while fresh (use with fingerprinted assets).')
    if (!has('no-store') && !has('no-cache') && !has('max-age') && !has('s-maxage') && !has('private') && !has('public')) add('warn', 'Cache-Control', 'No freshness or caching directive recognised.')
    if (get('expires').length && ma) add('info', 'Expires', 'Expires is ignored because Cache-Control: max-age is present.')
    if (get('pragma').length) add('info', 'Pragma', 'Pragma is an HTTP/1.0 relic; rely on Cache-Control.')
  } else if (p.kind === 'response') add('info', 'Cache-Control', 'Missing: caches will apply heuristic freshness. Set it explicitly.')
  const ct = one('content-type')
  if (ct) {
    if (/^(text\/|application\/(json|xml|javascript))/i.test(ct) && !/charset=/i.test(ct) && !/json/i.test(ct)) add('warn', 'Content-Type', 'Textual type without charset; browsers may guess the encoding.')
    else add('ok', 'Content-Type', `Media type ${ct.split(';')[0].trim()}.`)
    if (/^text\/html/i.test(ct) && p.kind === 'response' && !names.includes('x-content-type-options')) add('warn', 'X-Content-Type-Options', 'HTML response without nosniff.')
  } else if (p.kind === 'response' && !get('location').length) add('info', 'Content-Type', 'Missing — clients may sniff the body type.')
  if (names.includes('content-length') && names.includes('transfer-encoding')) add('error', 'Content-Length', 'Both Content-Length and Transfer-Encoding are present: a request-smuggling risk (RFC 9112 §6.3).')
  if (p.kind === 'response') {
    const hsts = one('strict-transport-security')
    if (!hsts) add('warn', 'Strict-Transport-Security', 'Missing HSTS. Add: max-age=31536000; includeSubDomains')
    else { const m = /max-age=(\d+)/i.exec(hsts); if (!m) add('error', 'Strict-Transport-Security', 'max-age directive is required.'); else if (Number(m[1]) < 15552000) add('warn', 'Strict-Transport-Security', `max-age=${m[1]} is under 6 months; use at least 31536000.`); else add('ok', 'Strict-Transport-Security', 'HSTS configured.'); if (hsts && !/includeSubDomains/i.test(hsts)) add('info', 'Strict-Transport-Security', 'Consider includeSubDomains.') }
    const csp = one('content-security-policy')
    if (!csp) add('warn', 'Content-Security-Policy', 'Missing CSP — no defense-in-depth against XSS.')
    else {
      if (/'unsafe-inline'/.test(csp)) add('warn', 'Content-Security-Policy', "'unsafe-inline' weakens XSS protection; prefer nonces/hashes.")
      if (/'unsafe-eval'/.test(csp)) add('warn', 'Content-Security-Policy', "'unsafe-eval' allows eval-like APIs.")
      if (/(^|[\s;])(default|script)-src[^;]*\s\*(\s|;|$)/.test(csp)) add('error', 'Content-Security-Policy', 'Wildcard (*) source in default-src/script-src allows scripts from anywhere.')
      if (!/default-src|script-src/.test(csp)) add('warn', 'Content-Security-Policy', 'No default-src or script-src directive.')
      if (!/frame-ancestors/.test(csp) && !get('x-frame-options').length) add('info', 'Content-Security-Policy', 'No frame-ancestors; clickjacking protection missing.')
      add('ok', 'Content-Security-Policy', 'CSP present.')
    }
    const xcto = one('x-content-type-options'); if (!xcto) add('warn', 'X-Content-Type-Options', 'Missing. Add: nosniff'); else if (xcto.toLowerCase() !== 'nosniff') add('error', 'X-Content-Type-Options', 'Only “nosniff” is a valid value.'); else add('ok', 'X-Content-Type-Options', 'nosniff set.')
    const xfo = one('x-frame-options'); if (xfo && !/^(deny|sameorigin)$/i.test(xfo.trim())) add('warn', 'X-Frame-Options', 'ALLOW-FROM is obsolete; use CSP frame-ancestors.')
    if (!names.includes('referrer-policy')) add('info', 'Referrer-Policy', 'Missing. Consider strict-origin-when-cross-origin.')
    if (!names.includes('permissions-policy')) add('info', 'Permissions-Policy', 'Missing. Restrict powerful features (camera, microphone, geolocation).')
    if (!names.includes('cross-origin-opener-policy')) add('info', 'Cross-Origin-Opener-Policy', 'Not set (needed for cross-origin isolation).')
    if (one('x-xss-protection') && one('x-xss-protection') !== '0') add('info', 'X-XSS-Protection', 'Deprecated; set to 0 and rely on CSP.')
    const server = one('server'); if (server && /\d+\.\d+/.test(server)) add('warn', 'Server', `Discloses software version (${server}).`)
    const xpb = one('x-powered-by'); if (xpb) add('warn', 'X-Powered-By', `Discloses technology (${xpb}); remove it.`)
    // CORS
    const acao = one('access-control-allow-origin'), acac = one('access-control-allow-credentials')
    if (acao !== undefined) {
      if (acao === '*' && acac?.toLowerCase() === 'true') add('error', 'Access-Control-Allow-Origin', 'Wildcard origin combined with credentials=true is invalid and blocked by browsers.')
      else if (acao === '*') add('info', 'Access-Control-Allow-Origin', 'Any origin may read this response (OK for public data only).')
      else if (acao === 'null') add('error', 'Access-Control-Allow-Origin', '“null” origin is exploitable (sandboxed iframes, file://).')
      else add('ok', 'Access-Control-Allow-Origin', `Restricted to ${acao}.`)
      if (acao !== '*' && !/origin/i.test(one('vary') ?? '')) add('warn', 'Vary', 'Dynamic ACAO should be accompanied by Vary: Origin to avoid cache poisoning.')
    }
    if (one('access-control-allow-methods')?.includes('*') && acac?.toLowerCase() === 'true') add('warn', 'Access-Control-Allow-Methods', 'Wildcard with credentials is treated literally by browsers.')
    // cookies
    get('set-cookie').forEach((c) => {
      const name = c.value.split('=')[0]; const l = c.value.toLowerCase()
      if (!/;\s*secure/.test(l)) add('warn', 'Set-Cookie', `Cookie “${name}” lacks Secure.`)
      if (!/;\s*httponly/.test(l)) add('warn', 'Set-Cookie', `Cookie “${name}” lacks HttpOnly (readable by scripts).`)
      const ss = /;\s*samesite=(\w+)/.exec(l); if (!ss) add('info', 'Set-Cookie', `Cookie “${name}” has no SameSite (browsers default to Lax).`); else if (ss[1] === 'none' && !/;\s*secure/.test(l)) add('error', 'Set-Cookie', `Cookie “${name}”: SameSite=None requires Secure.`)
      if (name.startsWith('__Host-') && (!/;\s*path=\/(;|$)/.test(l) || /;\s*domain=/.test(l))) add('error', 'Set-Cookie', `__Host- cookie “${name}” must have Path=/ and no Domain.`)
    })
  }
  if (p.kind === 'request') {
    if (one('authorization')) add('warn', 'Authorization', `Contains credentials (${one('authorization')!.split(' ')[0]}) — redact before sharing.`)
    if (get('cookie').length) add('warn', 'Cookie', 'Contains cookies — may include session identifiers.')
    if (/^Basic /i.test(one('authorization') ?? '')) add('warn', 'Authorization', 'Basic auth is only base64-encoded; use only over HTTPS.')
    if (!names.includes('host')) add('info', 'Host', 'HTTP/1.1 requests require a Host header.')
    if (names.includes('origin') && !names.includes('sec-fetch-site')) add('info', 'Origin', 'Cross-origin request; the server must reply with matching CORS headers.')
  }
  if (!f.length) add('info', '-', 'No issues detected.')
  return f
}
function humanSeconds(s: number) { return s >= 86400 ? `${(s / 86400).toFixed(s % 86400 ? 1 : 0)} day(s)` : s >= 3600 ? `${(s / 3600).toFixed(1)} hour(s)` : s >= 60 ? `${Math.round(s / 60)} minute(s)` : `${s} second(s)` }
