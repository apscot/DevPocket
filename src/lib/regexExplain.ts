const TOKENS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^\\d/, () => 'a digit [0-9]'], [/^\\D/, () => 'a non-digit'], [/^\\w/, () => 'a word character [A-Za-z0-9_]'], [/^\\W/, () => 'a non-word character'], [/^\\s/, () => 'whitespace'], [/^\\S/, () => 'non-whitespace'], [/^\\b/, () => 'a word boundary'], [/^\\B/, () => 'not a word boundary'],
  [/^\\([nrtfv0])/, (m) => `a ${({ n: 'newline', r: 'carriage return', t: 'tab', f: 'form feed', v: 'vertical tab', 0: 'NUL' } as Record<string, string>)[m[1]]}`], [/^\\u\{?[0-9a-fA-F]+\}?/, (m) => `unicode character ${m[0]}`], [/^\\x[0-9a-fA-F]{2}/, (m) => `character ${m[0]}`], [/^\\p\{[^}]+\}/, (m) => `Unicode property ${m[0]}`], [/^\\k<(\w+)>/, (m) => `backreference to group “${m[1]}”`], [/^\\(\d+)/, (m) => `backreference to group ${m[1]}`], [/^\\(.)/, (m) => `literal “${m[1]}”`],
  [/^\(\?<([A-Za-z_]\w*)>/, (m) => `start named capture group “${m[1]}”`], [/^\(\?:/, () => 'start non-capturing group'], [/^\(\?=/, () => 'positive lookahead'], [/^\(\?!/, () => 'negative lookahead'], [/^\(\?<=/, () => 'positive lookbehind'], [/^\(\?<!/, () => 'negative lookbehind'], [/^\(/, () => 'start capture group'], [/^\)/, () => 'end group'],
  [/^\[\^?(?:\\.|[^\]\\])*\]/, (m) => `${m[0][1] === '^' ? 'any character NOT in' : 'any one of'} ${m[0]}`], [/^\.\*\?/, () => 'any characters, lazily'], [/^\.\*/, () => 'any characters (greedy)'], [/^\./, () => 'any character (except newline unless s flag)'], [/^\^/, () => 'start of input/line'], [/^\$/, () => 'end of input/line'],
  [/^\{(\d+)(?:,(\d*))?\}\??/, (m) => (m[2] === undefined ? `exactly ${m[1]} times` : m[2] === '' ? `${m[1]} or more times` : `${m[1]} to ${m[2]} times`) + (m[0].endsWith('?') ? ' (lazy)' : '')], [/^\*\?/, () => 'zero or more, lazily'], [/^\+\?/, () => 'one or more, lazily'], [/^\?\?/, () => 'optional, lazily'], [/^\*/, () => 'zero or more times'], [/^\+/, () => 'one or more times'], [/^\?/, () => 'optional (zero or one)'], [/^\|/, () => 'OR (alternation)'],
]
export function explainRegex(p: string): { token: string; text: string }[] {
  const out: { token: string; text: string }[] = []; let rest = p
  while (rest) {
    let hit = false
    for (const [re, fn] of TOKENS) { const m = re.exec(rest); if (m) { out.push({ token: m[0], text: fn(m) }); rest = rest.slice(m[0].length); hit = true; break } }
    if (!hit) { const last = out[out.length - 1]; if (last && last.text.startsWith('literal text')) { last.token += rest[0]; last.text = `literal text “${last.token}”` } else out.push({ token: rest[0], text: `literal text “${rest[0]}”` }); rest = rest.slice(1) }
  }
  return out
}
