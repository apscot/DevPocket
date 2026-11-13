export function rng(seed?: number) {
  if (seed == null || Number.isNaN(seed)) return () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296 }
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const FIRST = ['Ada', 'Grace', 'Linus', 'Alan', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Guido', 'Hedy', 'Tim', 'Sophie', 'Yukihiro', 'Katherine', 'Brendan', 'Anita', 'Bjarne', 'Edsger', 'Joan']
const LAST = ['Lovelace', 'Hopper', 'Torvalds', 'Turing', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson', 'Perlman', 'van Rossum', 'Lamarr', 'Berners-Lee', 'Wilson', 'Matsumoto', 'Johnson', 'Eich', 'Borg', 'Stroustrup', 'Dijkstra', 'Clarke']
const CITY = ['London', 'Berlin', 'Tokyo', 'Toronto', 'Austin', 'Mumbai', 'Lagos', 'São Paulo', 'Sydney', 'Oslo', 'Seoul', 'Madrid']
const COUNTRY = ['United Kingdom', 'Germany', 'Japan', 'Canada', 'United States', 'India', 'Nigeria', 'Brazil', 'Australia', 'Norway', 'South Korea', 'Spain']
const STREET = ['Main St', 'Oak Ave', 'Park Rd', 'Maple Dr', 'High St', 'Cedar Ln', 'Elm St', 'Lake View']
const COMPANY = ['Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark Industries', 'Wayne Enterprises', 'Soylent', 'Vandelay', 'Cyberdyne']
const JOB = ['Software Engineer', 'Product Manager', 'Designer', 'Data Analyst', 'DevOps Engineer', 'QA Engineer', 'Architect', 'Support Lead']
const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim minim veniam quis nostrud'.split(' ')
const DOMAINS = ['example.com', 'example.org', 'mail.test', 'acme.dev']

export const MOCK_TYPES: [string, string][] = [
  ['id', 'Sequential ID'], ['uuid', 'UUID v4'], ['firstName', 'First name'], ['lastName', 'Last name'], ['fullName', 'Full name'], ['email', 'Email'], ['username', 'Username'],
  ['phone', 'Phone'], ['street', 'Street address'], ['city', 'City'], ['country', 'Country'], ['zip', 'ZIP / postal code'], ['company', 'Company'], ['jobTitle', 'Job title'],
  ['integer', 'Integer (min–max)'], ['float', 'Decimal (min–max)'], ['boolean', 'Boolean'], ['date', 'Date (ISO)'], ['datetime', 'Date-time (ISO)'], ['url', 'URL'], ['ipv4', 'IPv4'],
  ['color', 'Hex color'], ['word', 'Word'], ['sentence', 'Sentence'], ['paragraph', 'Paragraph'], ['enum', 'One of (comma list)'], ['null', 'Null'],
]
export interface MockField { name: string; type: string; min?: number; max?: number; options?: string }

export function genValue(type: string, r: () => number, f: Partial<MockField> = {}, idx = 0): unknown {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const int = (lo: number, hi: number) => Math.floor(r() * (hi - lo + 1)) + lo
  const hex = (n: number) => Array.from({ length: n }, () => int(0, 15).toString(16)).join('')
  switch (type) {
    case 'id': return (f.min ?? 1) + idx
    case 'uuid': return `${hex(8)}-${hex(4)}-4${hex(3)}-${pick(['8', '9', 'a', 'b'])}${hex(3)}-${hex(12)}`
    case 'firstName': return pick(FIRST)
    case 'lastName': return pick(LAST)
    case 'fullName': return `${pick(FIRST)} ${pick(LAST)}`
    case 'email': return `${pick(FIRST).toLowerCase()}.${pick(LAST).toLowerCase().replace(/[^a-z]/g, '')}${int(1, 99)}@${pick(DOMAINS)}`
    case 'username': return `${pick(FIRST).toLowerCase()}_${int(10, 9999)}`
    case 'phone': return `+1-${int(200, 999)}-${int(200, 999)}-${int(1000, 9999)}`
    case 'street': return `${int(1, 9999)} ${pick(STREET)}`
    case 'city': return pick(CITY)
    case 'country': return pick(COUNTRY)
    case 'zip': return String(int(10000, 99999))
    case 'company': return pick(COMPANY)
    case 'jobTitle': return pick(JOB)
    case 'integer': return int(f.min ?? 0, f.max ?? 1000)
    case 'float': { const lo = f.min ?? 0, hi = f.max ?? 1000; return Math.round((lo + r() * (hi - lo)) * 100) / 100 }
    case 'boolean': return r() < 0.5
    case 'date': return new Date(Date.UTC(2015, 0, 1) + Math.floor(r() * 3650) * 86400000).toISOString().slice(0, 10)
    case 'datetime': return new Date(Date.UTC(2015, 0, 1) + Math.floor(r() * 3650 * 86400) * 1000).toISOString()
    case 'url': return `https://${pick(DOMAINS)}/${pick(WORDS)}/${int(1, 999)}`
    case 'ipv4': return `${int(1, 254)}.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`
    case 'color': return `#${hex(6)}`
    case 'word': return pick(WORDS)
    case 'sentence': { const s = Array.from({ length: int(5, 12) }, () => pick(WORDS)).join(' '); return s[0].toUpperCase() + s.slice(1) + '.' }
    case 'paragraph': return Array.from({ length: int(2, 4) }, () => genValue('sentence', r)).join(' ')
    case 'enum': { const o = (f.options ?? '').split(',').map((x) => x.trim()).filter(Boolean); return o.length ? pick(o) : null }
    case 'null': return null
    default: throw new Error(`Unknown field type “${type}”.`)
  }
}
export function generateRecords(fields: MockField[], count: number, seed?: number): Record<string, unknown>[] {
  const r = rng(seed)
  return Array.from({ length: count }, (_, i) => Object.fromEntries(fields.filter((f) => f.name.trim()).map((f) => [f.name.trim(), genValue(f.type, r, f, i)])))
}

/** Build random JSON structure. */
export function randomJson(o: { depth: number; maxKeys: number; maxItems: number; seed?: number }): unknown {
  const r = rng(o.seed)
  const int = (lo: number, hi: number) => Math.floor(r() * (hi - lo + 1)) + lo
  const key = () => genValue('word', r) as string + (r() < 0.3 ? int(1, 99) : '')
  const leaf = () => { const t = int(0, 5); return t === 0 ? genValue('word', r) : t === 1 ? int(-1000, 100000) : t === 2 ? genValue('float', r) : t === 3 ? r() < 0.5 : t === 4 ? genValue('email', r) : null }
  const node = (d: number): unknown => {
    if (d <= 0) return leaf()
    const t = r()
    if (t < 0.5) { const out: Record<string, unknown> = {}; const n = int(1, Math.max(1, o.maxKeys)); for (let i = 0; i < n; i++) out[key()] = node(d - 1); return out }
    if (t < 0.8) { const n = int(0, o.maxItems); return Array.from({ length: n }, () => node(d - 1)) }
    return leaf()
  }
  const root = (() => { const out: Record<string, unknown> = {}; const n = int(2, Math.max(2, o.maxKeys)); for (let i = 0; i < n; i++) out[key()] = node(o.depth - 1); return out })()
  return root
}
/** Generate from a template where leaf string values are mock type names. */
export function fromTemplate(tpl: unknown, r: () => number, arrayLength: number, idx = 0): unknown {
  if (typeof tpl === 'string') { const [t, ...rest] = tpl.split(':'); const arg = rest.join(':'); const [min, max] = arg.split('-').map(Number); return genValue(t, r, { min: Number.isNaN(min) ? undefined : min, max: Number.isNaN(max) ? undefined : max, options: arg }, idx) }
  if (Array.isArray(tpl)) return tpl.length ? Array.from({ length: arrayLength }, (_, i) => fromTemplate(tpl[0], r, arrayLength, i)) : []
  if (tpl && typeof tpl === 'object') return Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, fromTemplate(v, r, arrayLength, idx)]))
  return tpl
}
