const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'
export function parseBig(input: string, base: number): bigint {
  let s = input.trim().replace(/[_\s,]/g, '').toLowerCase()
  if (!s) throw new Error('Enter a number.')
  let neg = false
  if (s[0] === '-' || s[0] === '+') { neg = s[0] === '-'; s = s.slice(1) }
  const prefixes: Record<string, number> = { '0x': 16, '0b': 2, '0o': 8 }
  const pre = prefixes[s.slice(0, 2)]
  if (pre && base === pre) s = s.slice(2)
  if (!s) throw new Error('Enter a number.')
  let r = 0n; const b = BigInt(base)
  for (const ch of s) {
    const d = DIGITS.indexOf(ch)
    if (d < 0 || d >= base) throw new Error(`Invalid digit “${ch}” for base ${base}.`)
    r = r * b + BigInt(d)
  }
  return neg ? -r : r
}
export function toBase(n: bigint, base: number): string {
  if (n === 0n) return '0'
  const neg = n < 0n; let x = neg ? -n : n; const b = BigInt(base); let out = ''
  while (x > 0n) { out = DIGITS[Number(x % b)] + out; x /= b }
  return (neg ? '-' : '') + out
}
export const bitLength = (n: bigint) => (n === 0n ? 0 : (n < 0n ? -n : n).toString(2).length)
export const group = (s: string, n: number) => { const neg = s.startsWith('-'); const b = neg ? s.slice(1) : s; const parts: string[] = []; for (let i = b.length; i > 0; i -= n) parts.unshift(b.slice(Math.max(0, i - n), i)); return (neg ? '-' : '') + parts.join(' ') }
export const twosComplement = (n: bigint, bits: number) => BigInt.asUintN(bits, n)
