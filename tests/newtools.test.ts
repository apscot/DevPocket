import { describe, expect, it } from 'vitest'
import { toToon } from '@/lib/toon'
import { toProto } from '@/lib/proto'
import { buildGraph } from '@/lib/graph'

describe('JSON → TOON', () => {
  it('encodes objects, primitive arrays and tabular arrays', () => {
    const v = { users: [{ id: 1, name: 'Ada', role: 'admin' }, { id: 2, name: 'Grace', role: 'user' }], tags: ['a', 'b'], meta: { count: 2, active: true }, none: null }
    expect(toToon(v)).toBe('users[2]{id,name,role}:\n  1,Ada,admin\n  2,Grace,user\ntags[2]: a,b\nmeta:\n  count: 2\n  active: true\nnone: null')
  })
  it('quotes ambiguous strings and escapes', () => {
    expect(toToon({ a: '', b: 'true', c: '42', d: 'x,y', e: ' pad', f: 'a:b', g: 'line\nbreak', h: '-x', i: 'plain text' })).toBe('a: ""\nb: "true"\nc: "42"\nd: "x,y"\ne: " pad"\nf: "a:b"\ng: "line\\nbreak"\nh: "-x"\ni: plain text')
    expect(toToon({ 'my key': 1 })).toBe('"my key": 1')
  })
  it('handles empty values, root arrays, mixed lists and options', () => {
    expect(toToon({ a: [], o: {} })).toBe('a[0]:\no:')
    expect(toToon([1, 2, 3])).toBe('[3]: 1,2,3')
    expect(toToon({ m: [1, { a: 1, b: [2] }, 'x'] })).toBe('m[3]:\n  - 1\n  - a: 1\n    b[1]: 2\n  - x')
    expect(toToon({ t: [{ a: 1 }, { a: 2 }] }, { delimiter: '|', lengthMarker: true })).toBe('t[#2|]{a}:\n  1\n  2')
    expect(toToon({ a: { b: 1 } }, { indent: 4 })).toBe('a:\n    b: 1')
    expect(toToon({ n: 1e21, z: -0, f: NaN })).toBe('n: 1000000000000000000000\nz: 0\nf: null')
  })
  it('non-uniform object arrays fall back to list form', () => { expect(toToon({ x: [{ a: 1 }, { b: 2 }] })).toBe('x[2]:\n  - a: 1\n  - b: 2') })
})

describe('JSON → Protobuf', () => {
  const p = toProto({ id: 1, big: 3000000000, price: 9.5, name: 'x', tags: ['a'], addr: { city: 'L' }, orders: [{ id: 1 }, { id: 2, c: 'q' }], n: null, userName: 'u', grid: [[1, 2]] }, { pkg: 'a.b', rootName: 'User', javaPackage: 'com.x' })
  it('emits proto3 with types, repeated and nested messages', () => {
    expect(p).toContain('syntax = "proto3";'); expect(p).toContain('package a.b;'); expect(p).toContain('option java_package = "com.x";')
    expect(p).toContain('int32 id = 1;'); expect(p).toContain('int64 big = 2;'); expect(p).toContain('double price = 3;'); expect(p).toContain('repeated string tags = 5;'); expect(p).toContain('Addr addr = 6;'); expect(p).toContain('repeated Order orders = 7;')
    expect(p).toContain('message Addr {\n  string city = 1;\n}'); expect(p).toContain('optional string c = 2;'); expect(p).toContain('import "google/protobuf/struct.proto";'); expect(p).toContain('google.protobuf.Value n = 8;')
    expect(p).toContain('string user_name = 9;'); expect(toProto({ 'x-y': 1, URL: 2 })).toContain('[json_name = "x-y"]'); expect(p).toContain('message GridList {\n  repeated int32 values = 1;\n}'); expect(p).toContain('repeated GridList grid = 10;')
  })
  it('rejects non-object roots', () => { expect(() => toProto(5)).toThrow(/Root JSON/) })
})

describe('JSON graph layout', () => {
  const g = buildGraph({ a: 1, b: { c: [1, { d: 2 }], e: {} }, f: 'x' })
  it('creates one node per non-empty container with edges and layered columns', () => {
    expect(g.nodes).toHaveLength(4); expect(g.edges).toHaveLength(3)
    expect(g.nodes.map((n) => n.depth)).toEqual([0, 1, 2, 3]); expect(new Set(g.nodes.map((n) => n.x)).size).toBe(4)
    expect(g.nodes[1].rows.find((r) => r.key === 'e')?.value).toBe('{}')
  })
  it('never overlaps nodes in the same column', () => {
    const big = buildGraph({ items: Array.from({ length: 30 }, (_, i) => ({ id: i, sub: { k: i } })) })
    const byCol = new Map<number, typeof big.nodes>(); big.nodes.forEach((n) => byCol.set(n.depth, [...(byCol.get(n.depth) ?? []), n]))
    for (const col of byCol.values()) { const s = [...col].sort((a, b) => a.y - b.y); for (let i = 1; i < s.length; i++) expect(s[i].y).toBeGreaterThanOrEqual(s[i - 1].y + s[i - 1].h) }
  })
  it('respects depth and node limits and handles primitives', () => {
    expect(buildGraph({ a: { b: { c: 1 } } }, { maxDepth: 1 }).truncated).toBe(true)
    expect(buildGraph(Array.from({ length: 20 }, () => ({ x: { y: 1 } })), { maxNodes: 5, maxRows: 100 }).nodes.length).toBeLessThanOrEqual(6)
    expect(buildGraph(42).nodes[0].rows[0].value).toBe('42'); expect(buildGraph({ k: Array.from({ length: 30 }, (_, i) => i) }, { maxRows: 5 }).nodes[1].rows).toHaveLength(6)
  })
})
