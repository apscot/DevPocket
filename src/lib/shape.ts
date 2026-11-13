// Shared type-inference IR used by the JSON → Schema / TypeScript / Zod / Java generators.
export type Shape =
  | { k: 'null' | 'string' | 'int' | 'long' | 'number' | 'bool' | 'any' }
  | { k: 'array'; item: Shape | null }
  | { k: 'object'; props: Map<string, { shape: Shape; optional: boolean }> }
  | { k: 'union'; of: Shape[] }

const NUM = new Set(['int', 'long', 'number'])
export function inferShape(v: unknown): Shape {
  if (v === null) return { k: 'null' }
  if (Array.isArray(v)) return { k: 'array', item: v.length ? v.map(inferShape).reduce(mergeShape) : null }
  switch (typeof v) {
    case 'string': return { k: 'string' }
    case 'boolean': return { k: 'bool' }
    case 'number': return Number.isInteger(v) ? (Math.abs(v) > 2147483647 ? { k: 'long' } : { k: 'int' }) : { k: 'number' }
    case 'object': return { k: 'object', props: new Map(Object.entries(v as object).map(([k, x]) => [k, { shape: inferShape(x), optional: false }])) }
    default: return { k: 'any' }
  }
}
const members = (s: Shape): Shape[] => (s.k === 'union' ? s.of : [s])
export function mergeShape(a: Shape, b: Shape): Shape {
  const out: Shape[] = []
  for (const m of [...members(a), ...members(b)]) {
    const i = out.findIndex((o) => o.k === m.k || (NUM.has(o.k) && NUM.has(m.k)))
    if (i < 0) { out.push(m); continue }
    const o = out[i]
    if (NUM.has(o.k) && NUM.has(m.k)) out[i] = { k: o.k === 'number' || m.k === 'number' ? 'number' : o.k === 'long' || m.k === 'long' ? 'long' : 'int' }
    else if (o.k === 'array' && m.k === 'array') out[i] = { k: 'array', item: o.item && m.item ? mergeShape(o.item, m.item) : (o.item ?? m.item) }
    else if (o.k === 'object' && m.k === 'object') {
      const props = new Map<string, { shape: Shape; optional: boolean }>()
      for (const [k, p] of o.props) { const q = m.props.get(k); props.set(k, q ? { shape: mergeShape(p.shape, q.shape), optional: p.optional || q.optional } : { shape: p.shape, optional: true }) }
      for (const [k, q] of m.props) if (!o.props.has(k)) props.set(k, { shape: q.shape, optional: true })
      out[i] = { k: 'object', props }
    }
  }
  return out.length === 1 ? out[0] : { k: 'union', of: out }
}
export const isNullable = (s: Shape) => s.k === 'null' || (s.k === 'union' && s.of.some((m) => m.k === 'null'))
export const nonNull = (s: Shape): Shape | null => {
  if (s.k === 'null') return null
  if (s.k !== 'union') return s
  const r = s.of.filter((m) => m.k !== 'null'); return r.length === 0 ? null : r.length === 1 ? r[0] : { k: 'union', of: r }
}

// ---- naming ----
export const words = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean)
export const pascal = (s: string) => words(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('') || 'Item'
export const camel = (s: string) => { const p = pascal(s); return p[0].toLowerCase() + p.slice(1) }
export const singular = (s: string) => (/ies$/i.test(s) ? s.replace(/ies$/i, 'y') : /(ss|us|is)$/i.test(s) ? s : /(sses|xes|ches|shes)$/i.test(s) ? s.replace(/es$/i, '') : /s$/i.test(s) ? s.slice(0, -1) : s)

// ---- JSON Schema ----
export function toJsonSchema(s: Shape, root = true, requireAll = true): Record<string, unknown> {
  const body = (m: Shape): Record<string, unknown> => {
    switch (m.k) {
      case 'null': return { type: 'null' }
      case 'string': return { type: 'string' }
      case 'int': case 'long': return { type: 'integer' }
      case 'number': return { type: 'number' }
      case 'bool': return { type: 'boolean' }
      case 'any': return {}
      case 'array': return m.item ? { type: 'array', items: toJsonSchema(m.item, false, requireAll) } : { type: 'array', items: {} }
      case 'object': {
        const req = [...m.props].filter(([, p]) => !p.optional).map(([k]) => k)
        return { type: 'object', properties: Object.fromEntries([...m.props].map(([k, p]) => [k, toJsonSchema(p.shape, false, requireAll)])), ...(requireAll && req.length ? { required: req } : {}) }
      }
      default: return {}
    }
  }
  let res: Record<string, unknown>
  if (s.k === 'union') {
    const parts = s.of.map(body)
    const simple = parts.every((p) => Object.keys(p).length === 1 && p.type)
    res = simple ? { type: parts.map((p) => p.type) } : { anyOf: parts }
  } else res = body(s)
  return root ? { $schema: 'https://json-schema.org/draft/2020-12/schema', ...res } : res
}

// ---- TypeScript ----
export interface TsOpts { rootName?: string; style?: 'interface' | 'type'; exportKw?: boolean; readonly?: boolean; allOptional?: boolean }
export function toTypeScript(value: unknown, o: TsOpts = {}): string {
  const root = pascal(o.rootName || 'Root')
  const decls: string[] = []; const used = new Set<string>()
  const uniq = (n: string) => { let x = n, i = 2; while (used.has(x)) x = n + i++; used.add(x); return x }
  const exp = o.exportKw === false ? '' : 'export '
  const ro = o.readonly ? 'readonly ' : ''
  const key = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k))
  const ty = (s: Shape, name: string): string => {
    switch (s.k) {
      case 'null': return 'null'
      case 'string': return 'string'
      case 'int': case 'long': case 'number': return 'number'
      case 'bool': return 'boolean'
      case 'any': return 'unknown'
      case 'array': { if (!s.item) return 'unknown[]'; const t = ty(s.item, singular(name)); return s.item.k === 'union' ? `(${t})[]` : `${t}[]` }
      case 'union': return s.of.map((m) => ty(m, name)).join(' | ')
      case 'object': {
        const n = uniq(pascal(name))
        const lines = [...s.props].map(([k, p]) => `  ${ro}${key(k)}${p.optional || o.allOptional ? '?' : ''}: ${ty(p.shape, k)};`)
        decls.push(o.style === 'type' ? `${exp}type ${n} = {\n${lines.join('\n')}\n};` : `${exp}interface ${n} {\n${lines.join('\n')}\n}`)
        return n
      }
    }
  }
  used.add(root)
  const s = inferShape(value)
  if (s.k === 'object') {
    used.delete(root); ty(s, root)
  } else {
    const t = ty(s, root)
    decls.push(`${exp}type ${root} = ${t};`)
  }
  return decls.join('\n\n')
}

// ---- Zod ----
export function toZod(value: unknown, o: { name?: string; exportKw?: boolean; inferType?: boolean } = {}): string {
  const name = pascal(o.name || 'Root')
  const z = (s: Shape, ind: string): string => {
    switch (s.k) {
      case 'null': return 'z.null()'
      case 'string': return 'z.string()'
      case 'int': case 'long': return 'z.number().int()'
      case 'number': return 'z.number()'
      case 'bool': return 'z.boolean()'
      case 'any': return 'z.unknown()'
      case 'array': return `z.array(${s.item ? z(s.item, ind) : 'z.unknown()'})`
      case 'union': {
        const nn = nonNull(s)
        if (nn && isNullable(s)) return `${z(nn, ind)}.nullable()`
        return `z.union([${s.of.map((m) => z(m, ind)).join(', ')}])`
      }
      case 'object': {
        if (!s.props.size) return 'z.object({})'
        const i2 = ind + '  '
        const lines = [...s.props].map(([k, p]) => `${i2}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${z(p.shape, i2)}${p.optional ? '.optional()' : ''},`)
        return `z.object({\n${lines.join('\n')}\n${ind}})`
      }
    }
  }
  const exp = o.exportKw === false ? '' : 'export '
  let out = `import { z } from 'zod';\n\n${exp}const ${name}Schema = ${z(inferShape(value), '')};`
  if (o.inferType !== false) out += `\n\n${exp}type ${name} = z.infer<typeof ${name}Schema>;`
  return out
}

// ---- Java ----
export interface JavaOpts { pkg?: string; rootName?: string; style?: 'pojo' | 'record' | 'lombok'; jackson?: boolean; primitives?: boolean; chaining?: boolean; separateNullable?: boolean }
const JAVA_RESERVED = new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record var'.split(' '))
export function toJava(value: unknown, o: JavaOpts = {}): string {
  const style = o.style ?? 'pojo'
  const root = pascal(o.rootName || 'Root')
  const imports = new Set<string>()
  const used = new Set<string>([root])
  const uniq = (n: string) => { let x = n, i = 2; while (used.has(x)) x = n + i++; used.add(x); return x }
  const field = (k: string) => { let f = camel(k); if (!/^[A-Za-z_]/.test(f)) f = '_' + f; return JAVA_RESERVED.has(f) ? f + '_' : f }
  const box = (t: string) => ({ int: 'Integer', long: 'Long', double: 'Double', boolean: 'Boolean' } as Record<string, string>)[t] ?? t

  const jt = (s: Shape, name: string, nested: string[], ind: string, forceBox: boolean): string => {
    const nn = nonNull(s); const nullable = isNullable(s)
    const target = nn ?? { k: 'any' as const }
    const wrapBox = forceBox || nullable || !o.primitives
    switch (target.k) {
      case 'string': return 'String'
      case 'int': return wrapBox ? 'Integer' : 'int'
      case 'long': return wrapBox ? 'Long' : 'long'
      case 'number': return wrapBox ? 'Double' : 'double'
      case 'bool': return wrapBox ? 'Boolean' : 'boolean'
      case 'array': { imports.add('java.util.List'); return `List<${target.item ? box(jt(target.item, singular(name), nested, ind, true)) : 'Object'}>` }
      case 'object': {
        const n = uniq(pascal(singular(name)) || 'Item')
        nested.push(genClass(target, n, ind, true))
        return n
      }
      case 'union': return 'Object'
      default: return 'Object'
    }
  }

  const genClass = (s: Extract<Shape, { k: 'object' }>, name: string, ind: string, isNested: boolean): string => {
    const i1 = ind + '    '
    const nestedDecls: string[] = []
    const fields = [...s.props].map(([k, p]) => ({ json: k, name: field(k), type: jt(p.shape, k, nestedDecls, i1, p.optional) }))
    if (fields.some((f) => f.name !== f.json) && o.jackson) imports.add('com.fasterxml.jackson.annotation.JsonProperty')
    const ann = (f: typeof fields[number]) => (o.jackson && f.name !== f.json ? `@JsonProperty("${f.json}") ` : '')
    const lines: string[] = []
    if (o.jackson) { imports.add('com.fasterxml.jackson.annotation.JsonIgnoreProperties'); lines.push(`${ind}@JsonIgnoreProperties(ignoreUnknown = true)`) }
    if (style === 'record') {
      lines.push(`${ind}public record ${name}(${fields.map((f) => `${ann(f)}${f.type} ${f.name}`).join(', ')}) {`)
      if (nestedDecls.length) lines.push(...nestedDecls.map((n) => '\n' + n))
      lines.push(`${ind}}`)
      return lines.join('\n')
    }
    if (style === 'lombok') { imports.add('lombok.Data'); imports.add('lombok.NoArgsConstructor'); imports.add('lombok.AllArgsConstructor'); lines.push(`${ind}@Data`, `${ind}@NoArgsConstructor`, `${ind}@AllArgsConstructor`) }
    lines.push(`${ind}public ${isNested ? 'static ' : ''}class ${name} {`)
    for (const f of fields) lines.push(`${i1}${ann(f)}private ${f.type} ${f.name};`)
    if (style === 'pojo') {
      for (const f of fields) {
        const cap = f.name[0].toUpperCase() + f.name.slice(1)
        lines.push('', `${i1}public ${f.type} ${f.type === 'boolean' ? 'is' : 'get'}${cap}() {`, `${i1}    return ${f.name};`, `${i1}}`, '', `${i1}public ${o.chaining ? name : 'void'} set${cap}(${f.type} ${f.name}) {`, `${i1}    this.${f.name} = ${f.name};`, ...(o.chaining ? [`${i1}    return this;`] : []), `${i1}}`)
      }
    }
    for (const n of nestedDecls) lines.push('', n)
    lines.push(`${ind}}`)
    return lines.join('\n')
  }

  const shape = inferShape(value)
  let body: string
  if (shape.k === 'object') body = genClass(shape, root, '', false)
  else if (shape.k === 'array' && shape.item && nonNull(shape.item)?.k === 'object') {
    // Root is an array of objects → generate element class
    body = genClass(nonNull(shape.item) as Extract<Shape, { k: 'object' }>, root, '', false)
  } else throw new Error('Root JSON value must be an object (or an array of objects) to generate Java classes.')
  const imp = [...imports].sort().map((i) => `import ${i};`).join('\n')
  return [o.pkg ? `package ${o.pkg};` : '', imp, body].filter(Boolean).join('\n\n') + '\n'
}
