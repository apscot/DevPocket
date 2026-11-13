import { describe, expect, it } from 'vitest'
import { b64decodeText, b64encodeText, b64ToBytes, bytesToB64, bytesToHex, decodeJwt, hexToBytes, htmlDecode, htmlEncode, urlDecode, urlEncode } from '@/lib/encode'
import { BUILTIN_RULES, detectSecrets, digest, entropyBits, generatePassword, hmacSign, hmacVerify, redact, secureInt, SETS } from '@/lib/security'
import { analyze, parseHeaders } from '@/lib/http'
import { buildCurl } from '@/lib/curl'
import { shq } from '@/lib/util'
import { sanitizeSvg } from '@/lib/svg'

describe('Base64 / hex', () => {
  it('round-trips UTF-8 and supports URL-safe and unpadded forms', () => {
    const s = 'Héllo, 世界 👋'
    expect(b64decodeText(b64encodeText(s))).toBe(s)
    expect(b64encodeText('Hello')).toBe('SGVsbG8='); expect(b64encodeText('Hello', false, false)).toBe('SGVsbG8')
    expect(b64encodeText('??>>', true)).toBe('Pz8-Pg=='); expect(b64decodeText('Pz8-Pg')).toBe('??>>'); expect(b64decodeText('SGVsbG8')).toBe('Hello')
  })
  it('rejects invalid input with useful messages', () => {
    expect(() => b64decodeText('@@@')).toThrow(/Invalid Base64 character/)
    expect(() => b64decodeText('A')).toThrow(/length/)
    expect(() => b64decodeText('/w==')).toThrow(/not valid UTF-8/) // 0xFF byte
  })
  it('converts between base64 and hex', () => {
    expect(bytesToHex(b64ToBytes('SGVsbG8='))).toBe('48656c6c6f'); expect(bytesToHex(b64ToBytes('SGVsbG8='), ':', true)).toBe('48:65:6C:6C:6F')
    expect(bytesToB64(hexToBytes('0x48 65-6c:6c,6f'))).toBe('SGVsbG8='); expect(() => hexToBytes('abc')).toThrow(/even/); expect(() => hexToBytes('zz')).toThrow(/Invalid hex/)
  })
})

describe('URL & HTML encoding', () => {
  it('encodes and decodes URL parts', () => {
    expect(urlEncode('a b&c=d/é')).toBe('a%20b%26c%3Dd%2F%C3%A9'); expect(urlEncode('a b', 'form')).toBe('a+b'); expect(urlEncode('https://x.com/a b?q=é', 'full')).toBe('https://x.com/a%20b?q=%C3%A9')
    expect(urlEncode("it's (ok)!")).toBe('it%27s%20%28ok%29%21')
    expect(urlDecode('a%20b%26')).toBe('a b&'); expect(urlDecode('a+b', 'form')).toBe('a b'); expect(() => urlDecode('%E0%A4%A')).toThrow(/Malformed/)
  })
  it('encodes and decodes HTML entities', () => {
    expect(htmlEncode('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;'); expect(htmlEncode('é©', { nonAscii: 'named' })).toBe('&eacute;&copy;'); expect(htmlEncode('é😀', { nonAscii: 'hex' })).toBe('&#xE9;&#x1F600;'); expect(htmlEncode("'", { quotes: false })).toBe("'")
    expect(htmlDecode('&lt;b&gt; &amp; &eacute; &#233; &#xe9; &copy; &nbsp;|')).toBe('<b> & é é é ©  |')
  })
  it('does not turn decoded text into executable markup', () => { const d = htmlDecode('&lt;img src=x onerror=alert(1)&gt;'); expect(d).toBe('<img src=x onerror=alert(1)>') })
})

describe('JWT', () => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  it('decodes header and payload locally', () => {
    const j = decodeJwt(token); expect(j.header).toEqual({ alg: 'HS256', typ: 'JWT' }); expect(j.payload).toEqual({ sub: '1234567890', name: 'John Doe', iat: 1516239022 }); expect(j.signature).toMatch(/^SflKxw/)
    expect(decodeJwt('Bearer ' + token).header.alg).toBe('HS256')
  })
  it('errors on malformed tokens', () => { expect(() => decodeJwt('a.b')).toThrow(/3 dot-separated/); expect(() => decodeJwt('x.y.z')).toThrow(/Could not decode header/) })
})

describe('Web Crypto hashing & HMAC', () => {
  const enc = (s: string) => new TextEncoder().encode(s)
  it('computes known SHA digests', async () => {
    expect(bytesToHex(await digest('SHA-256', enc('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(bytesToHex(await digest('SHA-1', enc('abc')))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
    expect(bytesToHex(await digest('SHA-512', enc('abc'))).slice(0, 32)).toBe('ddaf35a193617abacc417349ae204131')
    expect(bytesToHex(await digest('SHA-384', enc('abc'))).slice(0, 32)).toBe('cb00753f45a35e8bb5a03d699ac65007')
  })
  it('matches the RFC 4231 HMAC-SHA256 test vector and verifies signatures', async () => {
    const key = enc('Jefe'), msg = enc('what do ya want for nothing?')
    const sig = await hmacSign('SHA-256', key, msg)
    expect(bytesToHex(sig)).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
    expect(await hmacVerify('SHA-256', key, msg, sig)).toBe(true)
    expect(await hmacVerify('SHA-256', key, enc('tampered'), sig)).toBe(false)
    expect(await hmacVerify('SHA-256', enc('wrong'), msg, sig)).toBe(false)
  })
})

describe('Password generator', () => {
  const base = { length: 24, lower: true, upper: true, digits: true, symbols: true }
  it('respects length and includes every selected set', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword(base)
      expect(p).toHaveLength(24); expect(p).toMatch(/[a-z]/); expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/\d/); expect([...p].some((c) => SETS.symbols.includes(c))).toBe(true)
    }
  })
  it('honours exclusions and single sets', () => {
    expect(generatePassword({ ...base, upper: false, symbols: false, length: 40 })).toMatch(/^[a-z0-9]+$/)
    expect(generatePassword({ ...base, length: 200, exclude: 'aeiouAEIOU' })).not.toMatch(/[aeiouAEIOU]/)
    expect(generatePassword({ ...base, symbols: false, excludeAmbiguous: true, length: 200 })).not.toMatch(/[Il1O0o]/)
  })
  it('validates options', () => {
    expect(() => generatePassword({ ...base, lower: false, upper: false, digits: false, symbols: false })).toThrow(/at least one/)
    expect(() => generatePassword({ ...base, length: 2 })).toThrow(/at least 4/); expect(() => generatePassword({ ...base, length: 999 })).toThrow(/Maximum/)
  })
  it('uses secure, unbiased randomness', () => {
    const counts = new Array(6).fill(0); for (let i = 0; i < 6000; i++) counts[secureInt(6)]++
    counts.forEach((c) => { expect(c).toBeGreaterThan(800); expect(c).toBeLessThan(1200) })
    expect(entropyBits(20, 94)).toBe(131)
    const a = generatePassword(base), b = generatePassword(base); expect(a).not.toBe(b)
  })
  it('does not call Math.random', () => {
    const orig = Math.random; Math.random = () => { throw new Error('Math.random used') }
    try { expect(() => generatePassword(base)).not.toThrow() } finally { Math.random = orig }
  })
})

describe('Secret detection and redaction', () => {
  const on = BUILTIN_RULES.filter((r) => r.enabled !== false)
  const text = 'db.password=Sup3rS3cret!\nAKIAIOSFODNN7EXAMPLE\nAuthorization: Bearer abcdef1234567890abcdef12\n{"apiKey": "sk_live_51H8abcdefghijklmnop"}\nhttps://deploy:hunter2@git.example.com/r\nplain line stays\n-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----'
  it('finds credentials of several kinds', () => {
    const f = detectSecrets(text, on); const labels = f.map((x) => x.label)
    expect(labels).toContain('AWS access key ID'); expect(labels).toContain('Bearer token'); expect(labels).toContain('Private key block'); expect(labels).toContain('Credentials in URL'); expect(f.filter((x) => x.label === 'Secret assignment').length).toBeGreaterThanOrEqual(2)
  })
  it('redacts values but preserves surrounding text and counts', () => {
    const f = detectSecrets(text, on); const out = redact(text, f)
    expect(out).not.toContain('Sup3rS3cret!'); expect(out).not.toContain('hunter2'); expect(out).not.toContain('MIIabc'); expect(out).toContain('db.password='); expect(out).toContain('plain line stays'); expect(out).toContain('[REDACTED:'); expect(f.length).toBeGreaterThanOrEqual(5)
    expect(redact(text, f, 'stars')).toMatch(/\*{4,}/); expect(redact('token=abcdefghijklmnop', detectSecrets('token=abcdefghijklmnop', on), 'partial')).toMatch(/ab\*+op/)
  })
  it('supports custom rules and rejects invalid regex', () => {
    const f = detectSecrets('id EMP-123456 here', [], ['EMP-\\d{6}']); expect(f).toHaveLength(1); expect(redact('id EMP-123456 here', f, 'fixed')).toBe('id [REDACTED] here')
    expect(() => detectSecrets('x', [], ['(unclosed'])).toThrow(/Invalid custom regex/)
  })
  it('ignores placeholders and empty values', () => { expect(detectSecrets('password=\npassword=${DB_PASS}\npassword="***"', on)).toHaveLength(0) })
})

describe('HTTP header analysis', () => {
  it('parses response vs request and flags problems', () => {
    const p = parseHeaders('HTTP/1.1 200 OK\nContent-Type: text/html\nCache-Control: public, max-age=3600\nServer: nginx/1.18.0\nX-Powered-By: Express\nAccess-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true\nSet-Cookie: sid=1; Path=/\nStrict-Transport-Security: max-age=300\nContent-Security-Policy: default-src *; script-src \'unsafe-inline\'')
    expect(p.kind).toBe('response')
    const f = analyze(p).map((x) => `${x.sev}:${x.header}`)
    expect(f).toContain('error:Access-Control-Allow-Origin'); expect(f).toContain('warn:Set-Cookie'); expect(f).toContain('warn:Server'); expect(f).toContain('warn:X-Powered-By'); expect(f).toContain('warn:Strict-Transport-Security'); expect(f).toContain('warn:Content-Security-Policy'); expect(f).toContain('warn:X-Content-Type-Options')
  })
  it('flags smuggling-prone requests and detects request headers', () => {
    const p = parseHeaders('POST /x HTTP/1.1\nHost: a.com\nAuthorization: Basic abc\nContent-Length: 4\nTransfer-Encoding: chunked'); expect(p.kind).toBe('request')
    const f = analyze(p); expect(f.some((x) => x.sev === 'error' && x.header === 'Content-Length')).toBe(true); expect(f.some((x) => x.header === 'Authorization')).toBe(true)
  })
  it('reports malformed lines and handles folded headers', () => {
    const p = parseHeaders('Good: 1\nnot a header\nFolded: a\n  b'); expect(p.errors).toHaveLength(1); expect(p.headers[1].value).toBe('a b')
  })
  it('recognises a well-configured response', () => {
    const p = parseHeaders('HTTP/1.1 200 OK\nContent-Type: application/json\nCache-Control: no-store\nStrict-Transport-Security: max-age=31536000; includeSubDomains\nX-Content-Type-Options: nosniff\nContent-Security-Policy: default-src \'self\'; frame-ancestors \'none\'\nReferrer-Policy: no-referrer')
    expect(analyze(p).filter((x) => x.sev === 'error' || x.sev === 'warn')).toHaveLength(0)
  })
})

describe('cURL generator & shell escaping', () => {
  it('quotes values safely', () => {
    expect(shq('simple-1.2')).toBe('simple-1.2'); expect(shq("it's")).toBe("'it'\\''s'"); expect(shq('a b; rm -rf /')).toBe("'a b; rm -rf /'"); expect(shq('$(whoami)')).toBe("'$(whoami)'")
  })
  const base = { method: 'POST', url: 'https://x.test/a?b=1&c=2', headers: 'Accept: application/json', body: '{"n":"it\'s"}', bodyType: 'json' as const, auth: 'bearer' as const, token: 'T', follow: true, multiline: false }
  it('builds commands with headers, auth, body and options', () => {
    const c = buildCurl(base)
    expect(c).toBe(`curl 'https://x.test/a?b=1&c=2' -X POST -L -H 'Accept: application/json' -H 'Authorization: Bearer T' -H 'Content-Type: application/json' --data-raw '{"n":"it'\\''s"}'`)
    expect(buildCurl({ ...base, method: 'GET', bodyType: 'none', auth: 'basic', user: 'u', pass: 'p w', follow: false, insecure: true })).toMatch(/-k .*-u 'u:p w'/)
    expect(buildCurl({ ...base, multiline: true })).toContain(' \\\n  -X POST')
    expect(buildCurl({ ...base, bodyType: 'form', body: 'a=1 2\nb=ü' })).toContain("--data-urlencode 'a=1 2' --data-urlencode 'b=ü'")
  })
  it('validates input', () => {
    expect(() => buildCurl({ ...base, url: '' })).toThrow(/URL/); expect(() => buildCurl({ ...base, headers: 'bad header' })).toThrow(/Invalid header/); expect(() => buildCurl({ ...base, body: '{oops' })).toThrow(/not valid JSON/)
  })
})

describe('SVG sanitization', () => {
  it('removes scripts, event handlers and foreign content', () => {
    const r = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="5" height="5" onclick="alert(2)"/><foreignObject><div>x</div></foreignObject><a href="javascript:alert(3)"><circle r="2"/></a></svg>')
    expect(r.clean).toContain('<rect'); expect(r.clean).not.toMatch(/script|onclick|foreignObject|javascript:/i); expect(r.removed.length).toBeGreaterThan(0)
  })
  it('reports invalid XML and non-svg roots', () => { expect(sanitizeSvg('<svg><rect></svg>').error).toMatch(/Invalid/); expect(sanitizeSvg('<html/>').error).toMatch(/Root element/) })
})
