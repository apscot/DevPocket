import { describe, expect, it } from 'vitest'
import { diffCounts, diffJson, escapeJsonString, formatJson, jsonStats, minifyJson, parseJson, pointerLines, unescapeJsonString } from '@/lib/json'
import { csvToJson, csvToSql, detectDelimiter, jsonToCsv, parseCsv, stringifyCsv } from '@/lib/csv'
import { inferShape, toJava, toJsonSchema, toTypeScript, toZod } from '@/lib/shape'
import { diffText } from '@/lib/textdiff'
import { bitLength, parseBig, toBase } from '@/lib/bignum'
import { generateRecords, randomJson, fromTemplate, rng } from '@/lib/mock'
import Ajv from 'ajv/dist/2020'

describe('JSON formatting & errors', () => {
  it('formats with indent, sorts keys, minifies', () => {
    expect(formatJson('{"b":1,"a":[1,2]}', 2, true)).toBe('{\n  "a": [\n    1,\n    2\n  ],\n  "b": 1\n}')
    expect(formatJson('{"a":1}', 'tab')).toBe('{\n\t"a": 1\n}')
    expect(minifyJson('{ "a" : [ 1 , 2 ] }')).toBe('{"a":[1,2]}')
  })
  it('reports line and column for invalid JSON', () => {
    try { parseJson('{\n  "a": 1,\n  "b": }'); throw new Error('should fail') } catch (e: any) {
      expect(e.message).toMatch(/line 3/)
      expect(e.line).toBe(3)
    }
  })
  it('escapes and unescapes strings', () => {
    expect(escapeJsonString('a"b\nc\\')).toBe('a\\"b\\nc\\\\')
    expect(unescapeJsonString('"a\\"b\\nc"')).toBe('a"b\nc')
    expect(unescapeJsonString('tab\\there')).toBe('tab\there')
    expect(() => unescapeJsonString('bad\\qescape')).toThrow()
  })
  it('maps JSON pointers to lines', () => {
    const m = pointerLines('{\n "a": {\n  "b": 1\n },\n "c": [\n  2\n ]\n}')
    expect(m.get('/a/b')).toBe(3); expect(m.get('/c/0')).toBe(6)
  })
})

describe('JSON diff', () => {
  const a = { id: 1, name: 'A', tags: ['x', 'y'], n: { k: 1 }, gone: true, t: 1 }
  const b = { t: '1', n: { k: 2 }, tags: ['x', 'z', 'w'], name: 'A', id: 1, added: null }
  it('detects added/removed/modified/typeChanged ignoring key order', () => {
    const d = diffJson(a, b)
    const c = diffCounts(d)
    expect(c).toEqual({ added: 2, removed: 1, modified: 2, typeChanged: 1 })
    expect(d.find((x) => x.path === '$.t')?.kind).toBe('typeChanged')
    expect(d.find((x) => x.path === '$.gone')?.kind).toBe('removed')
  })
  it('identical documents yield no differences regardless of key order', () => {
    expect(diffJson({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toHaveLength(0)
  })
  it('unordered arrays ignore ordering', () => {
    expect(diffJson([1, 2, 3], [3, 1, 2], { arrayMode: 'unordered' })).toHaveLength(0)
    expect(diffJson([1, 2, 3], [3, 1, 2], { arrayMode: 'index' }).length).toBeGreaterThan(0)
  })
  it('computes stats', () => {
    const s = jsonStats({ a: [1, { b: 'xx' }], c: null })
    expect(s.maxDepth).toBe(3); expect(s.types.array).toBe(1); expect(s.types.object).toBe(2); expect(s.longestString?.length).toBe(2)
  })
})

describe('CSV', () => {
  it('parses quotes, escaped quotes, embedded newlines and CRLF', () => {
    expect(parseCsv('a,b\r\n"x,1","he said ""hi"""\r\n"line1\nline2",z')).toEqual([['a', 'b'], ['x,1', 'he said "hi"'], ['line1\nline2', 'z']])
  })
  it('throws on unterminated quote', () => { expect(() => parseCsv('a,"b')).toThrow(/Unterminated/) })
  it('detects delimiters', () => { expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';'); expect(detectDelimiter('a\tb\n1\t2')).toBe('\t') })
  it('csv → json with inference and header options', () => {
    expect(csvToJson('id,name,ok\n1,Ada,true\n2,,false')).toEqual([{ id: 1, name: 'Ada', ok: true }, { id: 2, name: '', ok: false }])
    expect(csvToJson('1,2\n3,4', { header: false })).toEqual([{ column1: 1, column2: 2 }, { column1: 3, column2: 4 }])
    expect(() => csvToJson('a,b\n1,2,3')).toThrow(/Row 2/)
  })
  it('json → csv flattens nested objects, handles missing fields and delimiters', () => {
    const csv = jsonToCsv([{ id: 1, a: { b: 2 }, t: [1, 2] }, { id: 2, extra: 'x,y' }])
    expect(csv).toBe('id,a.b,t,extra\n1,2,"[1,2]",\n2,,,"x,y"')
    expect(jsonToCsv([{ a: 1, b: 2 }], { delimiter: ';' })).toBe('a;b\n1;2')
    expect(jsonToCsv([{ a: { b: 1 } }], { flatten: false })).toBe('a\n"{""b"":1}"')
  })
  it('stringify quotes fields needing it', () => { expect(stringifyCsv([['a b', 'c"d', 'e\nf']])).toBe('a b,"c""d","e\nf"') })
  it('csv → SQL escapes values and supports NULL', () => {
    const sql = csvToSql("name,age,note\nO'Brien,30,\nAda,,hello", { table: 'people', quote: 'ansi' })
    expect(sql).toContain(`INSERT INTO "people" ("name", "age", "note") VALUES`)
    expect(sql).toContain("('O''Brien', 30, NULL)")
    expect(sql).toContain("('Ada', NULL, 'hello')")
    expect(csvToSql('a\n1', { batch: false })).toBe('INSERT INTO my_table (a) VALUES (1);')
  })
})

describe('Schema / TypeScript / Zod / Java generation', () => {
  const sample = { id: 1, price: 9.5, name: 'x', tags: ['a'], nested: { ok: true, big: 3000000000 }, items: [{ a: 1 }, { a: 2, b: 'q' }], n: null, my_field: 1 }
  it('infers JSON Schema with optional properties and ajv validates it', () => {
    const schema = toJsonSchema(inferShape(sample)) as any
    expect(schema.properties.id.type).toBe('integer'); expect(schema.properties.price.type).toBe('number')
    expect(schema.properties.items.items.required).toEqual(['a']) // b is optional
    const ajv = new Ajv({ strict: false }); const v = ajv.compile(schema)
    expect(v(sample)).toBe(true)
    expect(v({ ...sample, id: 'no' })).toBe(false)
  })
  it('generates TypeScript interfaces', () => {
    const ts = toTypeScript(sample, { rootName: 'Order' })
    expect(ts).toContain('export interface Order {'); expect(ts).toContain('export interface Nested {'); expect(ts).toContain('b?: string;'); expect(ts).toContain('n: null;'); expect(ts).toContain('tags: string[];')
    expect(toTypeScript([1, 'a'], { rootName: 'Mixed' })).toContain('type Mixed = (number | string)[]')
  })
  it('generates Zod schemas', () => {
    const z = toZod({ a: 1, b: [1.5], c: { d: null }, e: [1, null] }, { name: 'User' })
    expect(z).toContain("import { z } from 'zod'"); expect(z).toContain('z.number().int()'); expect(z).toContain('z.array(z.number())'); expect(z).toContain('UserSchema'); expect(z).toContain('z.null()'); expect(z).toContain('.nullable()')
  })
  it('generates Java POJO, record and Lombok DTOs', () => {
    const pojo = toJava(sample, { pkg: 'com.x', rootName: 'Order', style: 'pojo', jackson: true })
    expect(pojo).toContain('package com.x;'); expect(pojo).toContain('public class Order {'); expect(pojo).toContain('public static class Nested {'); expect(pojo).toContain('@JsonProperty("my_field")'); expect(pojo).toContain('private Long big;'); expect(pojo).toContain('private Double price;'); expect(pojo).toContain('public List<String> getTags()'); expect(pojo).toContain('import java.util.List;')
    expect(toJava({ a: 1, b: { c: 'x' } }, { style: 'record', rootName: 'R' })).toContain('public record R(Integer a, B b)')
    expect(toJava({ a: 1 }, { style: 'lombok', rootName: 'R' })).toContain('@Data')
    expect(toJava({ a: 1 }, { style: 'pojo', rootName: 'R', primitives: true })).toContain('private int a;')
    expect(() => toJava(5)).toThrow()
    expect(toJava({ class: 1 }, { rootName: 'R' })).toContain('private Integer class_;')
  })
})

describe('Text diff', () => {
  it('counts additions, removals and modifications', () => {
    const r = diffText('a\nb\nc\n', 'a\nB\nc\nd\n')
    expect(r.modified).toBe(1); expect(r.added).toBe(1); expect(r.removed).toBe(0)
    expect(diffText('a\n', 'a\n').rows.every((x) => x.kind === 'same')).toBe(true)
  })
  it('honours whitespace and case options', () => {
    expect(diffText('a  b\n', 'a b\n', { ignoreWhitespace: true }).modified).toBe(0)
    const r = diffText('Hello\n', 'hello\n', { ignoreCase: true }); expect(r.modified + r.added + r.removed).toBe(0); expect(r.rows[0].l?.text).toBe('Hello')
  })
})

describe('Big numbers', () => {
  it('converts without precision loss', () => {
    const n = parseBig('123456789012345678901234567890', 10)
    expect(toBase(n, 16)).toBe('18ee90ff6c373e0ee4e3f0ad2'); expect(parseBig(toBase(n, 2), 2)).toBe(n); expect(toBase(-255n, 16)).toBe('-ff')
    expect(parseBig('0xFF', 16)).toBe(255n); expect(bitLength(255n)).toBe(8)
  })
  it('validates digits', () => { expect(() => parseBig('12', 2)).toThrow(/Invalid digit/); expect(() => parseBig('', 10)).toThrow() })
})

describe('Generators', () => {
  it('seeded mock data is deterministic and respects field types', () => {
    const f = [{ name: 'id', type: 'id' }, { name: 'e', type: 'email' }, { name: 'n', type: 'integer', min: 5, max: 7 }, { name: 'u', type: 'uuid' }]
    const a = generateRecords(f, 5, 42), b = generateRecords(f, 5, 42)
    expect(a).toEqual(b); expect(a[2].id).toBe(3)
    a.forEach((r) => { expect(r.e).toMatch(/^[^@]+@[^@]+\.[a-z]+$/); expect(r.n as number).toBeGreaterThanOrEqual(5); expect(r.n as number).toBeLessThanOrEqual(7); expect(r.u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/) })
  })
  it('random JSON is valid, bounded and seed-stable', () => {
    const v = randomJson({ depth: 3, maxKeys: 3, maxItems: 2, seed: 7 }); expect(JSON.parse(JSON.stringify(v))).toEqual(v); expect(randomJson({ depth: 3, maxKeys: 3, maxItems: 2, seed: 7 })).toEqual(v)
    expect(jsonStats(v).maxDepth).toBeLessThanOrEqual(4)
  })
  it('template generation', () => {
    const o = fromTemplate({ id: 'uuid', tags: ['word'], r: 'integer:1-3' }, rng(1), 3) as any
    expect(o.tags).toHaveLength(3); expect([1, 2, 3]).toContain(o.r)
  })
})
