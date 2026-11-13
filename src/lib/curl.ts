import { shq } from './util'
export interface CurlOpts {
  method: string; url: string; headers: string; body: string; bodyType: 'none' | 'raw' | 'json' | 'form'
  auth: 'none' | 'basic' | 'bearer' | 'header'; user?: string; pass?: string; token?: string; authHeader?: string
  follow?: boolean; insecure?: boolean; verbose?: boolean; includeHeaders?: boolean; silent?: boolean; compressed?: boolean; timeout?: number; output?: string; multiline?: boolean; head?: boolean
}
export function buildCurl(o: CurlOpts): string {
  if (!o.url.trim()) throw new Error('Enter a URL.')
  const g: string[] = [] // each entry = one flag (+ its argument)
  const hs = o.headers.split('\n').map((h) => h.trim()).filter(Boolean)
  for (const h of hs) if (!/^[^:\s]+\s*:/.test(h)) throw new Error(`Invalid header “${h}” — expected Name: value.`)
  if (o.head) g.push('-I'); else if (o.method !== 'GET') g.push(`-X ${o.method}`)
  if (o.silent) g.push('-s'); if (o.verbose) g.push('-v'); if (o.includeHeaders && !o.head) g.push('-i')
  if (o.follow) g.push('-L'); if (o.insecure) g.push('-k'); if (o.compressed) g.push('--compressed')
  if (o.timeout) g.push(`--max-time ${Math.floor(o.timeout)}`)
  for (const h of hs) g.push(`-H ${shq(h)}`)
  if (o.auth === 'basic') g.push(`-u ${shq(`${o.user ?? ''}:${o.pass ?? ''}`)}`)
  if (o.auth === 'bearer') g.push(`-H ${shq(`Authorization: Bearer ${o.token ?? ''}`)}`)
  if (o.auth === 'header') g.push(`-H ${shq(`${o.authHeader || 'X-API-Key'}: ${o.token ?? ''}`)}`)
  if (o.bodyType !== 'none' && o.body.trim() && !o.head) {
    if (o.bodyType === 'json') {
      try { JSON.parse(o.body) } catch (e) { throw new Error(`Body is not valid JSON: ${(e as Error).message}`) }
      if (!hs.some((h) => /^content-type/i.test(h))) g.push(`-H ${shq('Content-Type: application/json')}`)
      g.push(`--data-raw ${shq(o.body)}`)
    } else if (o.bodyType === 'form') for (const l of o.body.split('\n').map((x) => x.trim()).filter(Boolean)) g.push(`--data-urlencode ${shq(l)}`)
    else g.push(`--data-raw ${shq(o.body)}`)
  }
  if (o.output) g.push(`-o ${shq(o.output)}`)
  const all = ['curl ' + shq(o.url.trim()), ...g]
  return o.multiline === false ? all.join(' ') : all.join(' \\\n  ')
}
