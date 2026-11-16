import { describe, expect, it } from 'vitest'
import { SAMPLE_SPEC, deref, exampleFor, loadModel, parseSpec, schemaRows, stats, toCurl, toMarkdown, typeLabel } from '@/lib/openapi'

describe('OpenAPI / Swagger model', () => {
  const m = loadModel(SAMPLE_SPEC)
  it('builds endpoints, tags, servers and security', () => {
    expect(m.kind).toBe('openapi3'); expect(m.title).toBe('Petstore Plus')
    expect(stats(m)).toMatchObject({ endpoints: 6, schemas: 5, deprecated: 1 })
    expect(m.servers).toHaveLength(2); expect(m.security[0]).toMatchObject({ name: 'bearerAuth', detail: 'HTTP bearer (JWT)' })
    const get = m.endpoints.find((e) => e.id === 'get /pets/{petId}')!
    expect(get.params[0]).toMatchObject({ name: 'petId', in: 'path', required: true })
    expect(get.security).toEqual(['bearerAuth'])
    expect(m.endpoints.find((e) => e.path === '/health')!.security).toEqual([])
    expect(m.endpoints.find((e) => e.path === '/health')!.tags).toEqual(['default'])
  })
  it('resolves $ref responses and lints', () => {
    const list = m.endpoints.find((e) => e.operationId === 'listPets')!
    expect(list.responses.find((r) => r.code === '401')!.description).toMatch(/Missing/)
    expect(m.warnings).toEqual([])
    const bad = loadModel(JSON.stringify({ openapi: '3.0.0', paths: { '/a/{id}': { get: { responses: { 200: { description: 'x', content: { 'application/json': { schema: { $ref: '#/components/schemas/Nope' } } } } } } }, '/b': { get: { operationId: 'x', responses: {} }, post: { operationId: 'x', responses: {} } } } }))
    const w = bad.warnings.join('\n')
    expect(w).toMatch(/Unresolved reference #\/components\/schemas\/Nope/)
    expect(w).toMatch(/Duplicate operationId "x"/)
    expect(w).toMatch(/no path parameter/)
  })
  it('generates examples, merges allOf and survives recursion', () => {
    const ex = exampleFor(m.raw, { $ref: '#/components/schemas/Pet' }) as any
    expect(ex).toMatchObject({ name: 'Rex', status: 'available' }); expect(typeof ex.id).toBe('number')
    const rows = schemaRows(m.raw, { $ref: '#/components/schemas/Pet' })
    expect(rows.map((r) => r.name)).toEqual(expect.arrayContaining(['name', 'id', 'status', 'children']))
    expect(rows.find((r) => r.name === 'name')!.required).toBe(true)
    expect(typeLabel(m.raw, { type: 'array', items: { $ref: '#/components/schemas/Pet' } })).toBe('Pet[]')
    expect(typeLabel(m.raw, { type: 'string', format: 'date-time' })).toBe('string<date-time>')
    expect(deref(m.raw, '#/components/schemas/Order')).toBeTruthy()
  })
  it('builds cURL with path, query, auth and body', () => {
    const c = toCurl(m, m.endpoints.find((e) => e.operationId === 'createPet')!)
    expect(c).toContain("curl -X POST 'https://api.petstore.example.com/v1/pets'"); expect(c).toContain('Authorization: Bearer <token>'); expect(c).toContain('"name": "Rex"')
    expect(toCurl(m, m.endpoints.find((e) => e.operationId === 'getPet')!)).toContain('/pets/0')
  })
  it('reads Swagger 2.0', () => {
    const s = loadModel(JSON.stringify({ swagger: '2.0', info: { title: 'Old', version: '1' }, host: 'x.io', basePath: '/api', schemes: ['https'], consumes: ['application/json'], produces: ['application/json'],
      paths: { '/u/{id}': { get: { operationId: 'g', parameters: [{ name: 'id', in: 'path', required: true, type: 'integer' }, { name: 'b', in: 'body', schema: { $ref: '#/definitions/U' } }], responses: { 200: { description: 'ok', schema: { $ref: '#/definitions/U' } } } } } },
      definitions: { U: { type: 'object', properties: { n: { type: 'string' } } } }, securityDefinitions: { k: { type: 'apiKey', in: 'header', name: 'X-K' } } }))
    expect(s.kind).toBe('swagger2'); expect(s.servers[0].url).toBe('https://x.io/api'); expect(s.endpoints[0].params).toHaveLength(1)
    expect(s.endpoints[0].body!.bodies[0].contentType).toBe('application/json'); expect(s.endpoints[0].responses[0].bodies).toHaveLength(1)
    expect(s.schemas).toHaveLength(1); expect(toCurl(s, s.endpoints[0])).toContain('https://x.io/api/u/0')
  })
  it('rejects bad input clearly', () => {
    expect(() => parseSpec('')).toThrow(/Paste/); expect(() => parseSpec('{"a":1}')).toThrow(/Not an OpenAPI/); expect(() => parseSpec('openapi: [')).toThrow(/parse/)
  })
  it('exports a markdown reference', () => { expect(toMarkdown(m)).toMatch(/### `GET \/pets`/) })
})
