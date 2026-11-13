import { inferShape, isNullable, nonNull, pascal, singular, words, type Shape } from './shape'

export interface ProtoOpts { pkg?: string; rootName?: string; javaPackage?: string; optional?: boolean; goPackage?: string }
const snake = (s: string) => { const w = words(s).map((x) => x.toLowerCase()).join('_'); return /^\d/.test(w) || !w ? `f_${w}` : w }

export function toProto(value: unknown, o: ProtoOpts = {}): string {
  const root = pascal(o.rootName || 'Root')
  const msgs: string[] = []; const used = new Set<string>([root]); let needsValue = false
  const uniq = (n: string) => { let x = n, i = 2; while (used.has(x)) x = n + i++; used.add(x); return x }
  const typeOf = (s: Shape, name: string): { type: string; repeated: boolean } => {
    const t = nonNull(s)
    if (!t) { needsValue = true; return { type: 'google.protobuf.Value', repeated: false } }
    switch (t.k) {
      case 'string': return { type: 'string', repeated: false }
      case 'int': return { type: 'int32', repeated: false }
      case 'long': return { type: 'int64', repeated: false }
      case 'number': return { type: 'double', repeated: false }
      case 'bool': return { type: 'bool', repeated: false }
      case 'object': return { type: msg(t, uniq(pascal(singular(name)))), repeated: false }
      case 'array': {
        if (!t.item) { needsValue = true; return { type: 'google.protobuf.Value', repeated: true } }
        const inner = nonNull(t.item)
        if (inner?.k === 'array') { // proto has no repeated-of-repeated: wrap
          const w = uniq(pascal(singular(name)) + 'List'); const it = typeOf(inner, singular(name))
          msgs.push(`message ${w} {\n  ${it.repeated ? 'repeated ' : ''}${it.type} values = 1;\n}`)
          return { type: w, repeated: true }
        }
        return { ...typeOf(t.item, singular(name)), repeated: true }
      }
      default: needsValue = true; return { type: 'google.protobuf.Value', repeated: false }
    }
  }
  const msg = (s: Extract<Shape, { k: 'object' }>, name: string): string => {
    const lines: string[] = []; const names = new Set<string>(); let n = 1
    const idx = msgs.length; msgs.push('')
    for (const [k, p] of s.props) {
      let f = snake(k); for (let i = 2; names.has(f); i++) f = snake(k) + i; names.add(f)
      const t = typeOf(p.shape, k)
      const opt = !t.repeated && o.optional !== false && (p.optional || isNullable(p.shape)) && t.type !== 'google.protobuf.Value'
      const jn = f.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase()) !== k ? ` [json_name = "${k.replace(/"/g, '\\"')}"]` : ''
      lines.push(`  ${t.repeated ? 'repeated ' : opt ? 'optional ' : ''}${t.type} ${f} = ${n++};${jn}`)
    }
    msgs[idx] = `message ${name} {\n${lines.join('\n')}\n}`
    return name
  }
  const shape = inferShape(value)
  const obj = shape.k === 'object' ? shape : shape.k === 'array' && shape.item && nonNull(shape.item)?.k === 'object' ? (nonNull(shape.item) as Extract<Shape, { k: 'object' }>) : null
  if (!obj) throw new Error('Root JSON value must be an object (or an array of objects) to generate Protobuf messages.')
  msg(obj, root)
  const head = ['syntax = "proto3";', '']
  if (o.pkg) head.push(`package ${o.pkg};`, '')
  if (needsValue) head.push('import "google/protobuf/struct.proto";', '')
  if (o.javaPackage) head.push(`option java_package = "${o.javaPackage}";`, 'option java_multiple_files = true;')
  if (o.goPackage) head.push(`option go_package = "${o.goPackage}";`)
  return head.join('\n').replace(/\n+$/, '\n') + '\n' + msgs.join('\n\n') + '\n'
}
