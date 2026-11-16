import * as yaml from 'js-yaml'

/** Swagger 2.0 / OpenAPI 3.x → one normalised model for the viewer. Pure, no network. */
export type Json = any
export const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const
export type Method = (typeof METHODS)[number]

export interface Param { name: string; in: string; required: boolean; description: string; schema: Json; deprecated: boolean; example?: unknown }
export interface Body { contentType: string; schema: Json; example?: unknown }
export interface Resp { code: string; description: string; bodies: Body[]; headers: string[] }
export interface Endpoint {
  id: string; method: Method; path: string; summary: string; description: string; operationId: string
  tags: string[]; deprecated: boolean; params: Param[]; body: { required: boolean; description: string; bodies: Body[] } | null
  responses: Resp[]; security: string[]; servers: string[]
}
export interface SecScheme { name: string; type: string; detail: string }
export interface Model {
  version: string; kind: 'swagger2' | 'openapi3'
  title: string; description: string; apiVersion: string; contact: string; license: string; terms: string
  servers: { url: string; description: string }[]
  tags: { name: string; description: string }[]
  endpoints: Endpoint[]; schemas: { name: string; schema: Json }[]; security: SecScheme[]
  warnings: string[]
  raw: Json
}

export function parseSpec(text: string): Json {
  const t = text.trim()
  if (!t) throw new Error('Paste an OpenAPI / Swagger document (JSON or YAML).')
  let doc: Json
  try { doc = t[0] === '{' ? JSON.parse(t) : yaml.load(t, { schema: yaml.JSON_SCHEMA }) } catch (e) {
    throw new Error(`Could not parse as JSON or YAML: ${(e as Error).message.split('\n')[0]}`)
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('The document must be an object.')
  if (!doc.openapi && !doc.swagger) throw new Error('Not an OpenAPI/Swagger document: missing "openapi" or "swagger" version field.')
  if (!doc.paths && !doc.components && !doc.definitions && !doc.webhooks) throw new Error('No "paths" found in the document.')
  return doc
}

const isObj = (v: unknown): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Resolve a local JSON pointer ($ref) such as #/components/schemas/Pet. */
export function deref(root: Json, ref: string): Json {
  if (!ref.startsWith('#/')) return undefined
  let cur = root
  for (const raw of ref.slice(2).split('/')) {
    const k = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~')
    if (!isObj(cur) && !Array.isArray(cur)) return undefined
    cur = (cur as Json)[k]
  }
  return cur
}
export const refName = (ref: string) => ref.split('/').pop() ?? ref

/** Follow a chain of $refs (cycle-safe) and return the target plus the first name it passed through. */
function follow(root: Json, v: Json): { v: Json; name?: string } {
  let name: string | undefined; const seen = new Set<string>()
  while (isObj(v) && typeof v.$ref === 'string') {
    if (seen.has(v.$ref)) return { v: {}, name }
    seen.add(v.$ref); name ??= refName(v.$ref)
    const t = deref(root, v.$ref); if (t === undefined) return { v: { 'x-unresolved': v.$ref }, name }
    v = t
  }
  return { v, name }
}

/** Compact type label: "string<date-time>", "Pet[]", "object", "A | B". */
export function typeLabel(root: Json, s: Json, depth = 0): string {
  if (!isObj(s)) return 'any'
  if (typeof s.$ref === 'string') return refName(s.$ref)
  if (depth > 4) return 'object'
  if (s.enum && !s.type) return 'enum'
  const comb = s.oneOf ? 'oneOf' : s.anyOf ? 'anyOf' : s.allOf ? 'allOf' : ''
  if (comb) return (s[comb] as Json[]).map((x) => typeLabel(root, x, depth + 1)).join(comb === 'allOf' ? ' & ' : ' | ')
  let t = Array.isArray(s.type) ? s.type.join(' | ') : s.type
  if (!t) t = s.properties ? 'object' : s.items ? 'array' : 'any'
  if (t === 'array') return `${typeLabel(root, s.items ?? {}, depth + 1)}[]`
  if (s.format) t += `<${s.format}>`
  if (s.nullable) t += ' | null'
  return t
}

/** Realistic example value for a schema. Uses example/default/enum first; depth- and cycle-limited. */
export function exampleFor(root: Json, s: Json, depth = 0, seen: string[] = []): unknown {
  if (!isObj(s)) return null
  if (typeof s.$ref === 'string') {
    if (seen.includes(s.$ref) || depth > 6) return null
    const t = deref(root, s.$ref); return t === undefined ? null : exampleFor(root, t, depth + 1, [...seen, s.$ref])
  }
  if (s.example !== undefined) return s.example
  if (Array.isArray(s.examples) && s.examples.length) return s.examples[0]
  if (s.default !== undefined) return s.default
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[0]
  if (s.const !== undefined) return s.const
  if (depth > 6) return null
  if (Array.isArray(s.allOf)) {
    const parts = s.allOf.map((x: Json) => exampleFor(root, x, depth + 1, seen))
    return parts.every(isObj) ? Object.assign({}, ...parts) : parts[0] ?? null
  }
  const alt = s.oneOf?.[0] ?? s.anyOf?.[0]; if (alt) return exampleFor(root, alt, depth + 1, seen)
  const type = Array.isArray(s.type) ? s.type.find((x: string) => x !== 'null') : s.type
  if (type === 'object' || s.properties || s.additionalProperties) {
    const o: Record<string, unknown> = {}
    for (const [k, v] of Object.entries<Json>(s.properties ?? {})) o[k] = exampleFor(root, v, depth + 1, seen)
    if (!Object.keys(o).length && isObj(s.additionalProperties)) o.additionalProp1 = exampleFor(root, s.additionalProperties, depth + 1, seen)
    return o
  }
  if (type === 'array') return [exampleFor(root, s.items ?? {}, depth + 1, seen)]
  switch (type) {
    case 'integer': return s.minimum ?? 0
    case 'number': return s.minimum ?? 0
    case 'boolean': return true
    case 'string':
      switch (s.format) {
        case 'date-time': return '2024-01-01T12:00:00Z'
        case 'date': return '2024-01-01'
        case 'uuid': return '3fa85f64-5717-4562-b3fc-2c963f66afa6'
        case 'email': return 'user@example.com'
        case 'uri': case 'url': return 'https://example.com'
        case 'byte': return 'U3dhZ2dlcg=='
        case 'binary': return '(binary)'
        case 'password': return '********'
        default: return 'string'
      }
    default: return null
  }
}

export interface Row { name: string; type: string; required: boolean; description: string; extras: string[]; depth: number }
/** Flatten a schema into table rows for display (properties nested up to maxDepth, $refs expanded once per path). */
export function schemaRows(root: Json, s: Json, maxDepth = 3): Row[] {
  const out: Row[] = []
  const walk = (node: Json, depth: number, seen: string[], prefix: string) => {
    const { v, name } = follow(root, node)
    if (!isObj(v)) return
    if (name && seen.includes(name)) return
    const here = name ? [...seen, name] : seen
    const merged: Json = Array.isArray(v.allOf) ? mergeAllOf(root, v) : v
    const props = merged.properties as Record<string, Json> | undefined
    const req: string[] = merged.required ?? []
    if (props) {
      for (const [k, p] of Object.entries(props)) {
        const f = follow(root, p).v
        out.push({ name: prefix + k, type: typeLabel(root, p), required: req.includes(k), description: String(f?.description ?? ''), extras: constraints(f), depth })
        if (depth < maxDepth) {
          const target = f?.type === 'array' ? f.items ?? {} : p
          const inner = follow(root, target).v
          if (isObj(inner) && (inner.properties || inner.allOf)) walk(target, depth + 1, here, '')
        }
      }
    } else if (v.type === 'array' && depth === 0) {
      walk(v.items ?? {}, depth, here, '')
    }
  }
  walk(s, 0, [], '')
  return out
}
function mergeAllOf(root: Json, s: Json): Json {
  const out: Json = { ...s, properties: { ...(s.properties ?? {}) }, required: [...(s.required ?? [])] }
  for (const part of s.allOf ?? []) {
    const p = follow(root, part).v; if (!isObj(p)) continue
    const m = Array.isArray(p.allOf) ? mergeAllOf(root, p) : p
    Object.assign(out.properties, m.properties ?? {}); out.required.push(...(m.required ?? []))
  }
  return out
}
function constraints(s: Json): string[] {
  if (!isObj(s)) return []
  const c: string[] = []
  if (s.enum) c.push(`enum: ${s.enum.slice(0, 8).map((x: unknown) => JSON.stringify(x)).join(', ')}${s.enum.length > 8 ? ', …' : ''}`)
  if (s.default !== undefined) c.push(`default: ${JSON.stringify(s.default)}`)
  if (s.minimum !== undefined) c.push(`min ${s.minimum}`)
  if (s.maximum !== undefined) c.push(`max ${s.maximum}`)
  if (s.minLength !== undefined) c.push(`minLength ${s.minLength}`)
  if (s.maxLength !== undefined) c.push(`maxLength ${s.maxLength}`)
  if (s.pattern) c.push(`pattern ${s.pattern}`)
  if (s.readOnly) c.push('read-only')
  if (s.writeOnly) c.push('write-only')
  if (s.deprecated) c.push('deprecated')
  return c
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

function bodiesOf(root: Json, content: Json, schemaFallback?: Json, mimes?: string[]): Body[] {
  const out: Body[] = []
  if (isObj(content)) {
    for (const [ct, m] of Object.entries<Json>(content)) {
      const mm = isObj(m) ? m : {}
      let ex: unknown = mm.example
      if (ex === undefined && isObj(mm.examples)) { const first = Object.values<Json>(mm.examples)[0]; ex = follow(root, first).v?.value }
      out.push({ contentType: ct, schema: mm.schema ?? {}, example: ex })
    }
  } else if (schemaFallback) {
    for (const ct of mimes?.length ? mimes : ['application/json']) out.push({ contentType: ct, schema: schemaFallback })
  }
  return out
}

export function buildModel(doc: Json): Model {
  const warnings: string[] = []
  const kind = doc.swagger ? 'swagger2' : 'openapi3'
  const info = isObj(doc.info) ? doc.info : {}
  const servers: Model['servers'] = kind === 'swagger2'
    ? (doc.host || doc.basePath ? [{ url: `${(doc.schemes?.[0] ?? 'https')}://${doc.host ?? ''}${doc.basePath ?? ''}`.replace(/\/$/, ''), description: '' }] : [])
    : (Array.isArray(doc.servers) ? doc.servers : []).filter(isObj).map((s: Json) => ({ url: str(s.url), description: str(s.description) }))
  const endpoints: Endpoint[] = []
  const globalSec: string[] = (Array.isArray(doc.security) ? doc.security : []).flatMap((r: Json) => Object.keys(r ?? {}))
  const seenOps = new Map<string, string>()

  for (const [path, rawItem] of Object.entries<Json>(isObj(doc.paths) ? doc.paths : {})) {
    const item = follow(doc, rawItem).v; if (!isObj(item)) continue
    const shared: Json[] = Array.isArray(item.parameters) ? item.parameters : []
    for (const m of METHODS) {
      const op = item[m]; if (!isObj(op)) continue
      const merged = new Map<string, Param>()
      for (const raw of [...shared, ...(Array.isArray(op.parameters) ? op.parameters : [])]) {
        const p = follow(doc, raw).v; if (!isObj(p) || !p.name) { warnings.push(`${m.toUpperCase()} ${path}: unresolved parameter reference`); continue }
        if (kind === 'swagger2' && p.in === 'body') continue
        merged.set(`${p.in}:${p.name}`, {
          name: String(p.name), in: String(p.in ?? 'query'), required: !!p.required || p.in === 'path', description: str(p.description),
          schema: p.schema ?? (kind === 'swagger2' ? { type: p.type, format: p.format, enum: p.enum, items: p.items, default: p.default } : {}),
          deprecated: !!p.deprecated, example: p.example,
        })
      }
      const params = [...merged.values()]
      let body: Endpoint['body'] = null
      if (kind === 'openapi3') {
        const rb = follow(doc, op.requestBody).v
        if (isObj(rb)) body = { required: !!rb.required, description: str(rb.description), bodies: bodiesOf(doc, rb.content) }
      } else {
        const all: Json[] = [...shared, ...(Array.isArray(op.parameters) ? op.parameters : [])].map((x) => follow(doc, x).v)
        const bp = all.find((p) => isObj(p) && p.in === 'body')
        const forms = all.filter((p) => isObj(p) && p.in === 'formData')
        const consumes: string[] = op.consumes ?? doc.consumes ?? []
        if (bp) body = { required: !!bp.required, description: str(bp.description), bodies: bodiesOf(doc, undefined, bp.schema ?? {}, consumes) }
        else if (forms.length) body = { required: forms.some((f) => f.required), description: '', bodies: [{ contentType: consumes[0] ?? 'application/x-www-form-urlencoded', schema: { type: 'object', properties: Object.fromEntries(forms.map((f) => [f.name, { type: f.type, description: f.description, format: f.format }])), required: forms.filter((f) => f.required).map((f) => f.name) } }] }
        for (const f of forms) merged.delete(`formData:${f.name}`)
      }
      const produces: string[] = op.produces ?? doc.produces ?? []
      const responses: Resp[] = Object.entries<Json>(isObj(op.responses) ? op.responses : {}).map(([code, r0]) => {
        const r = follow(doc, r0).v
        return { code, description: str(r?.description), bodies: kind === 'swagger2' ? (r?.schema ? bodiesOf(doc, undefined, r.schema, produces) : []) : bodiesOf(doc, r?.content), headers: Object.keys(isObj(r?.headers) ? r.headers : {}) }
      }).sort((a, b) => a.code.localeCompare(b.code))
      if (!responses.length) warnings.push(`${m.toUpperCase()} ${path}: no responses defined`)
      const opSec: string[] | null = Array.isArray(op.security) ? op.security.flatMap((r: Json) => Object.keys(r ?? {})) : null
      const operationId = str(op.operationId)
      if (operationId) { const prev = seenOps.get(operationId); if (prev) warnings.push(`Duplicate operationId "${operationId}" (${prev} and ${m.toUpperCase()} ${path})`); else seenOps.set(operationId, `${m.toUpperCase()} ${path}`) }
      else warnings.push(`${m.toUpperCase()} ${path}: missing operationId`)
      for (const p of params) if (p.in === 'path' && !path.includes(`{${p.name}}`)) warnings.push(`${m.toUpperCase()} ${path}: path parameter "${p.name}" is not in the URL`)
      for (const seg of path.match(/\{([^}]+)\}/g) ?? []) if (!merged.has(`path:${seg.slice(1, -1)}`)) warnings.push(`${m.toUpperCase()} ${path}: URL variable ${seg} has no path parameter`)
      endpoints.push({
        id: `${m} ${path}`, method: m, path, summary: str(op.summary), description: str(op.description), operationId,
        tags: Array.isArray(op.tags) && op.tags.length ? op.tags.map(String) : ['default'], deprecated: !!op.deprecated, params, body, responses,
        security: opSec ?? globalSec, servers: Array.isArray(op.servers) ? op.servers.map((s: Json) => str(s?.url)) : [],
      })
    }
  }

  const defs = kind === 'swagger2' ? doc.definitions : doc.components?.schemas
  const schemas = Object.entries<Json>(isObj(defs) ? defs : {}).map(([name, schema]) => ({ name, schema }))
  const secRaw = kind === 'swagger2' ? doc.securityDefinitions : doc.components?.securitySchemes
  const security: SecScheme[] = Object.entries<Json>(isObj(secRaw) ? secRaw : {}).map(([name, s0]) => {
    const s = follow(doc, s0).v ?? {}
    const detail = s.type === 'apiKey' ? `API key in ${s.in} "${s.name}"` : s.type === 'http' ? `HTTP ${s.scheme}${s.bearerFormat ? ` (${s.bearerFormat})` : ''}` : s.type === 'basic' ? 'HTTP Basic' : s.type === 'oauth2' ? `OAuth2 ${Object.keys(s.flows ?? { [s.flow ?? 'flow']: 1 }).join(', ')}` : s.type === 'openIdConnect' ? 'OpenID Connect' : ''
    return { name, type: String(s.type ?? ''), detail }
  })
  // dangling $ref scan
  const dangling = new Set<string>()
  const scan = (v: Json, d = 0) => {
    if (d > 60 || !v || typeof v !== 'object') return
    if (typeof v.$ref === 'string') { if (v.$ref.startsWith('#/') && deref(doc, v.$ref) === undefined) dangling.add(v.$ref); return }
    for (const k of Object.keys(v)) scan(v[k], d + 1)
  }
  scan(doc)
  for (const r of dangling) warnings.push(`Unresolved reference ${r}`)
  const tagDefs = (Array.isArray(doc.tags) ? doc.tags : []).filter(isObj).map((t: Json) => ({ name: str(t.name), description: str(t.description) }))
  for (const e of endpoints) for (const t of e.tags) if (!tagDefs.some((d: { name: string }) => d.name === t)) tagDefs.push({ name: t, description: '' })

  return {
    version: String(doc.openapi ?? doc.swagger), kind, title: str(info.title) || 'Untitled API', description: str(info.description), apiVersion: str(info.version),
    contact: [info.contact?.name, info.contact?.email, info.contact?.url].filter(Boolean).join(' · '), license: str(info.license?.name), terms: str(info.termsOfService),
    servers, tags: tagDefs, endpoints, schemas, security, warnings: warnings.slice(0, 200), raw: doc,
  }
}

export const loadModel = (text: string) => buildModel(parseSpec(text))

/** cURL for an endpoint using example values. */
export function toCurl(m: Model, e: Endpoint, serverUrl?: string): string {
  const base = (serverUrl ?? e.servers[0] ?? m.servers[0]?.url ?? 'https://api.example.com').replace(/\/$/, '')
  let path = e.path
  const q: string[] = []; const headers: string[] = []
  for (const p of e.params) {
    const val = p.example ?? exampleFor(m.raw, p.schema)
    const s = val === null || val === undefined ? 'value' : typeof val === 'object' ? JSON.stringify(val) : String(val)
    if (p.in === 'path') path = path.replace(`{${p.name}}`, encodeURIComponent(s))
    else if (p.in === 'query' && p.required) q.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(s)}`)
    else if (p.in === 'header' && p.required) headers.push(`${p.name}: ${s}`)
  }
  for (const name of e.security) {
    const sc = m.security.find((x) => x.name === name)
    if (sc?.type === 'http' && /bearer/i.test(sc.detail)) headers.push('Authorization: Bearer <token>')
    else if (sc?.type === 'http' || sc?.type === 'basic') headers.push('Authorization: Basic <credentials>')
    else if (sc?.type === 'apiKey' && sc.detail.includes('header')) headers.push(`${/"([^"]+)"/.exec(sc.detail)?.[1] ?? 'X-API-Key'}: <key>`)
    else if (sc?.type === 'oauth2' || sc?.type === 'openIdConnect') headers.push('Authorization: Bearer <access_token>')
  }
  const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
  const parts = [`curl -X ${e.method.toUpperCase()} ${sq(`${base}${path}${q.length ? `?${q.join('&')}` : ''}`)}`]
  for (const h of [...new Set(headers)]) parts.push(`-H ${sq(h)}`)
  const b = e.body?.bodies[0]
  if (b) {
    parts.push(`-H ${sq(`Content-Type: ${b.contentType}`)}`)
    const ex = b.example ?? exampleFor(m.raw, b.schema)
    if (/json/.test(b.contentType)) parts.push(`-d ${sq(JSON.stringify(ex, null, 2))}`)
    else if (isObj(ex)) for (const [k, v] of Object.entries(ex)) parts.push(`-d ${sq(`${k}=${v}`)}`)
  }
  return parts.join(' \\\n  ')
}

export function stats(m: Model) {
  const by: Record<string, number> = {}
  for (const e of m.endpoints) by[e.method] = (by[e.method] ?? 0) + 1
  return { endpoints: m.endpoints.length, byMethod: by, schemas: m.schemas.length, tags: m.tags.length, deprecated: m.endpoints.filter((e) => e.deprecated).length }
}

/** Markdown API reference (useful for wikis / READMEs). */
export function toMarkdown(m: Model): string {
  const L: string[] = [`# ${m.title}${m.apiVersion ? ` (v${m.apiVersion})` : ''}`, '']
  if (m.description) L.push(m.description, '')
  if (m.servers.length) L.push('## Servers', '', ...m.servers.map((s) => `- \`${s.url}\`${s.description ? ` — ${s.description}` : ''}`), '')
  for (const t of m.tags) {
    const eps = m.endpoints.filter((e) => e.tags.includes(t.name)); if (!eps.length) continue
    L.push(`## ${t.name}`, ''); if (t.description) L.push(t.description, '')
    for (const e of eps) {
      L.push(`### \`${e.method.toUpperCase()} ${e.path}\`${e.deprecated ? ' (deprecated)' : ''}`, '')
      if (e.summary) L.push(`**${e.summary}**`, ''); if (e.description) L.push(e.description, '')
      if (e.params.length) L.push('| Name | In | Type | Required | Description |', '|---|---|---|---|---|', ...e.params.map((p) => `| \`${p.name}\` | ${p.in} | ${typeLabel(m.raw, p.schema)} | ${p.required ? 'yes' : 'no'} | ${p.description.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`), '')
      if (e.body) L.push(`Request body (${e.body.bodies.map((b) => b.contentType).join(', ')})${e.body.required ? ' — required' : ''}`, '')
      if (e.responses.length) L.push('| Status | Description |', '|---|---|', ...e.responses.map((r) => `| ${r.code} | ${r.description.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`), '')
    }
  }
  return L.join('\n')
}

export const SAMPLE_SPEC = `openapi: 3.0.3
info:
  title: Petstore Plus
  version: 1.2.0
  description: A sample pet store API used to try the viewer. Supports **markdown**.
  contact: { name: API Team, email: api@example.com }
  license: { name: MIT }
servers:
  - url: https://api.petstore.example.com/v1
    description: Production
  - url: https://staging.petstore.example.com/v1
    description: Staging
tags:
  - name: pets
    description: Everything about your pets
  - name: store
    description: Orders and inventory
security:
  - bearerAuth: []
paths:
  /pets:
    get:
      tags: [pets]
      summary: List pets
      operationId: listPets
      parameters:
        - name: status
          in: query
          schema: { type: string, enum: [available, pending, sold], default: available }
        - name: limit
          in: query
          description: Maximum items to return
          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
      responses:
        '200':
          description: A page of pets
          headers:
            X-Total-Count: { schema: { type: integer } }
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/Pet' }
        '401': { $ref: '#/components/responses/Unauthorized' }
    post:
      tags: [pets]
      summary: Add a pet
      operationId: createPet
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NewPet' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Pet' }
        '400':
          description: Validation error
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }
  /pets/{petId}:
    parameters:
      - name: petId
        in: path
        required: true
        schema: { type: integer, format: int64 }
    get:
      tags: [pets]
      summary: Get a pet by id
      operationId: getPet
      responses:
        '200':
          description: The pet
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Pet' }
        '404': { description: Not found }
    delete:
      tags: [pets]
      summary: Remove a pet
      operationId: deletePet
      deprecated: true
      description: Use the archive flow instead.
      responses:
        '204': { description: Deleted }
  /store/orders:
    post:
      tags: [store]
      summary: Place an order
      operationId: placeOrder
      requestBody:
        content:
          application/json:
            schema: { $ref: '#/components/schemas/Order' }
      responses:
        '200':
          description: Order placed
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Order' }
  /health:
    get:
      summary: Liveness probe
      operationId: health
      security: []
      responses:
        '200': { description: OK }
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
  responses:
    Unauthorized:
      description: Missing or invalid token
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
  schemas:
    NewPet:
      type: object
      required: [name]
      properties:
        name: { type: string, example: Rex }
        tag: { type: string }
        category: { $ref: '#/components/schemas/Category' }
    Pet:
      allOf:
        - $ref: '#/components/schemas/NewPet'
        - type: object
          required: [id]
          properties:
            id: { type: integer, format: int64, readOnly: true }
            status: { type: string, enum: [available, pending, sold] }
            children:
              type: array
              items: { $ref: '#/components/schemas/Pet' }
    Category:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
    Order:
      type: object
      properties:
        id: { type: integer, format: int64 }
        petId: { type: integer, format: int64 }
        quantity: { type: integer, minimum: 1 }
        shipDate: { type: string, format: date-time }
        complete: { type: boolean, default: false }
    Error:
      type: object
      required: [code, message]
      properties:
        code: { type: integer, example: 400 }
        message: { type: string, example: name is required }
`
