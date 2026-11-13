export type JArg = { t: 'int' | 'double' | 'string' | 'bool' | 'char' | 'null'; v: string | number | bigint | boolean | null; raw: string }

export function parseArg(line: string): JArg {
  const s = line.trim()
  if (s === 'null') return { t: 'null', v: null, raw: s }
  if (/^(true|false)$/i.test(s)) return { t: 'bool', v: s.toLowerCase() === 'true', raw: s }
  if (/^[+-]?\d+[lL]?$/.test(s)) return { t: 'int', v: BigInt(s.replace(/[lL]$/, '')), raw: s }
  if (/^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?[fFdD]?$/.test(s)) return { t: 'double', v: Number(s.replace(/[fFdD]$/, '')), raw: s }
  if (/^'.'$/.test(s)) return { t: 'char', v: s[1], raw: s }
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return { t: 'string', v: s.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"'), raw: s }
  return { t: 'string', v: line, raw: s }
}

export class JavaFormatError extends Error { constructor(public kind: string, msg: string) { super(`${kind}: ${msg}`) } }

/** Round-half-up (java.util.Formatter semantics) using the shortest decimal representation of the double. */
function fixed(x: number, prec: number): string {
  if (!Number.isFinite(x)) return Number.isNaN(x) ? 'NaN' : x < 0 ? '-Infinity' : 'Infinity'
  const neg = x < 0 || Object.is(x, -0); const ex = Math.abs(x).toExponential()
  const [mant, e] = ex.split('e'); const exp = Number(e)
  const digits = mant.replace('.', '')
  // value = 0.digits × 10^(exp+1)
  let intPart: string, frac: string
  const pointPos = exp + 1
  if (pointPos <= 0) { intPart = '0'; frac = '0'.repeat(-pointPos) + digits } else if (pointPos >= digits.length) { intPart = digits + '0'.repeat(pointPos - digits.length); frac = '' } else { intPart = digits.slice(0, pointPos); frac = digits.slice(pointPos) }
  if (frac.length > prec) {
    const roundUp = frac.charCodeAt(prec) >= 53
    frac = frac.slice(0, prec)
    if (roundUp) { const all = BigInt(intPart + frac) + 1n; let s = all.toString().padStart(prec + 1, '0'); intPart = s.slice(0, s.length - prec) || '0'; frac = prec ? s.slice(s.length - prec) : '' }
  } else frac = frac.padEnd(prec, '0')
  const res = prec ? `${intPart}.${frac}` : intPart
  return (neg && /[1-9]/.test(res) ? '-' : neg ? '-' : '') + res
}
const group3 = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export function javaFormat(fmt: string, args: JArg[]): string {
  const re = /%(\d+\$)?([-#+ 0,(<]*)?(\d+)?(\.\d+)?([a-zA-Z%])/g
  let out = '', last = 0, ordinary = 0, prevIdx = -1
  const typeName = (a: JArg) => ({ int: 'java.lang.Long', double: 'java.lang.Double', string: 'java.lang.String', bool: 'java.lang.Boolean', char: 'java.lang.Character', null: 'null' }[a.t])
  const check = fmt.replace(re, '')
  const stray = /%/.exec(check)
  if (stray) { const rest = check.slice(stray.index, stray.index + 3); throw new JavaFormatError('UnknownFormatConversionException', `Conversion = '${rest[1] ?? '%'}'`) }
  let m: RegExpExecArray | null
  while ((m = re.exec(fmt))) {
    out += fmt.slice(last, m.index); last = m.index + m[0].length
    const [, argIdx, flagsRaw = '', widthS, precS, conv] = m
    const flags = flagsRaw
    const width = widthS ? Number(widthS) : 0, prec = precS ? Number(precS.slice(1)) : undefined
    if (conv === 'n') { out += '\n'; continue }
    if (conv === '%') { out += pad('%', width, flags.includes('-'), false); continue }
    let idx: number
    if (flags.includes('<')) idx = prevIdx; else if (argIdx) idx = Number(argIdx.slice(0, -1)) - 1; else idx = ordinary++
    if (idx < 0 || idx >= args.length) throw new JavaFormatError('MissingFormatArgumentException', `Format specifier '${m[0]}'`)
    prevIdx = idx
    const a = args[idx]
    let s: string
    const lower = conv.toLowerCase()
    switch (lower) {
      case 's': s = a.t === 'null' ? 'null' : a.t === 'bool' ? String(a.v) : a.t === 'double' ? javaDoubleToString(a.v as number) : String(a.v); if (prec !== undefined) s = s.slice(0, prec); break
      case 'b': s = a.t === 'null' ? 'false' : a.t === 'bool' ? String(a.v) : 'true'; break
      case 'c': if (a.t === 'null') s = 'null'; else if (a.t === 'char') s = String(a.v); else if (a.t === 'int') s = String.fromCodePoint(Number(a.v)); else throw new JavaFormatError('IllegalFormatConversionException', `c != ${typeName(a)}`); break
      case 'h': s = a.t === 'null' ? 'null' : (javaHash(String(a.v)) >>> 0).toString(16); break
      case 'd': case 'x': case 'o': {
        if (a.t === 'null') { s = 'null'; break }
        if (a.t !== 'int') throw new JavaFormatError('IllegalFormatConversionException', `${conv} != ${typeName(a)}`)
        const n = a.v as bigint
        if (lower === 'd') { let digits = (n < 0n ? -n : n).toString(); if (flags.includes(',')) digits = group3(digits); s = signed(digits, n < 0n, flags) }
        else { const base = lower === 'x' ? 16 : 8; let t = (n < 0n ? BigInt.asUintN(64, n) : n).toString(base); if (flags.includes('#')) t = (lower === 'x' ? '0x' : '0') + t; s = t }
        if (flags.includes('0') && width > s.length) { const sign = /^[-+ (]/.test(s) ? s[0] : ''; s = sign + '0'.repeat(width - s.length) + s.slice(sign.length) }
        break
      }
      case 'f': case 'e': case 'g': {
        if (a.t === 'null') { s = 'null'; break }
        if (a.t !== 'double') throw new JavaFormatError('IllegalFormatConversionException', `${conv} != ${typeName(a)}`)
        const x = a.v as number; const p = prec ?? 6
        let body: string
        if (!Number.isFinite(x)) body = Number.isNaN(x) ? 'NaN' : 'Infinity'
        else if (lower === 'f') { body = fixed(Math.abs(x), p); if (flags.includes(',')) { const [i, f] = body.split('.'); body = group3(i) + (f !== undefined ? '.' + f : '') } }
        else if (lower === 'e') { body = Math.abs(x).toExponential(p).replace(/e([+-])(\d)$/, 'e$10$2') }
        else { const pp = p === 0 ? 1 : p; const ax = Math.abs(x); body = ax !== 0 && (ax < 1e-4 || ax >= 10 ** pp) ? ax.toExponential(pp - 1).replace(/e([+-])(\d)$/, 'e$10$2') : fixed(ax, Math.max(0, pp - 1 - (ax === 0 ? 0 : Math.floor(Math.log10(ax))))) }
        s = signed(body, x < 0 || Object.is(x, -0), flags)
        if (flags.includes('0') && width > s.length && Number.isFinite(x)) { const sign = /^[-+ (]/.test(s) ? s[0] : ''; s = sign + '0'.repeat(width - s.length) + s.slice(sign.length) }
        break
      }
      default: throw new JavaFormatError('UnknownFormatConversionException', `Conversion = '${conv}'`)
    }
    if (conv === conv.toUpperCase() && conv !== conv.toLowerCase()) s = s.toUpperCase()
    out += pad(s, width, flags.includes('-'), false)
  }
  return out + fmt.slice(last)
}
const pad = (s: string, w: number, left: boolean, _z: boolean) => (s.length >= w ? s : left ? s.padEnd(w) : s.padStart(w))
function signed(body: string, neg: boolean, flags: string) { return neg ? (flags.includes('(') ? `(${body})` : `-${body}`) : flags.includes('+') ? `+${body}` : flags.includes(' ') ? ` ${body}` : body }
export function javaHash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h }
function javaDoubleToString(x: number) { return Number.isInteger(x) && Math.abs(x) < 1e7 ? x.toFixed(1) : String(x) }
