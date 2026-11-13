import { diffLines, diffWordsWithSpace, createTwoFilesPatch } from 'diff'

export interface DiffOpts { ignoreWhitespace?: boolean; ignoreCase?: boolean; trimTrailing?: boolean }
export interface Side { n: number; text: string; parts?: { text: string; changed: boolean }[] }
export interface DiffRow { kind: 'same' | 'add' | 'del' | 'mod'; l?: Side; r?: Side }

export function diffText(a: string, b: string, o: DiffOpts = {}): { rows: DiffRow[]; added: number; removed: number; modified: number } {
  const trim = (s: string) => (o.trimTrailing ? s.replace(/[ \t]+$/gm, '') : s)
  const A = trim(a), B = trim(b)
  const la = A.split('\n'), lb = B.split('\n')
  const cmp = (s: string) => { let x = s; if (o.ignoreWhitespace) x = x.replace(/[ \t]+/g, ' ').replace(/^ | $/gm, ''); return o.ignoreCase ? x.toLowerCase() : x }
  // Case folding keeps line structure identical, so original text is looked up by line number.
  const parts = diffLines(cmp(A), cmp(B))
  const rows: DiffRow[] = []
  let ln = 1, rn = 1, added = 0, removed = 0, modified = 0
  const count = (v: string) => { const n = v.split('\n').length; return v.endsWith('\n') ? n - 1 : n }
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (!p.added && !p.removed) {
      for (let k = count(p.value); k > 0; k--) rows.push({ kind: 'same', l: { n: ln, text: la[ln - 1] }, r: { n: rn, text: lb[rn - 1] } }), ln++, rn++
      continue
    }
    const next = parts[i + 1]
    if (p.removed && next?.added) {
      const nl = count(p.value), nr = count(next.value)
      for (let k = 0; k < Math.max(nl, nr); k++) {
        if (k < nl && k < nr) {
          const lt = la[ln - 1], rt = lb[rn - 1]
          const wd = diffWordsWithSpace(lt, rt)
          rows.push({ kind: 'mod', l: { n: ln++, text: lt, parts: wd.filter((x) => !x.added).map((x) => ({ text: x.value, changed: !!x.removed })) }, r: { n: rn++, text: rt, parts: wd.filter((x) => !x.removed).map((x) => ({ text: x.value, changed: !!x.added })) } })
          modified++
        } else if (k < nl) { rows.push({ kind: 'del', l: { n: ln, text: la[ln - 1] } }); ln++; removed++ }
        else { rows.push({ kind: 'add', r: { n: rn, text: lb[rn - 1] } }); rn++; added++ }
      }
      i++; continue
    }
    if (p.removed) for (let k = count(p.value); k > 0; k--) { rows.push({ kind: 'del', l: { n: ln, text: la[ln - 1] } }); ln++; removed++ }
    else for (let k = count(p.value); k > 0; k--) { rows.push({ kind: 'add', r: { n: rn, text: lb[rn - 1] } }); rn++; added++ }
  }
  return { rows, added, removed, modified }
}
export const unifiedPatch = (a: string, b: string, an = 'original', bn = 'modified') => createTwoFilesPatch(an, bn, a, b)
