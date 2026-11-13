interface Req { pattern: string; flags: string; text: string; replacement?: string }
self.onmessage = (e: MessageEvent<Req>) => {
  const { pattern, flags, text, replacement } = e.data
  try {
    const re = new RegExp(pattern, flags.includes('g') || flags.includes('y') ? flags : flags + 'g')
    const matches: { index: number; text: string; groups: (string | undefined)[]; named: Record<string, string | undefined>; indices?: [number, number][] }[] = []
    let m: RegExpExecArray | null
    const cap = 5000
    while ((m = re.exec(text)) && matches.length < cap) {
      matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: { ...(m.groups ?? {}) }, indices: (m as unknown as { indices?: [number, number][] }).indices?.slice(1) })
      if (m[0] === '') re.lastIndex++
      if (!flags.includes('g') && !flags.includes('y')) break
    }
    let replaced: string | undefined
    if (replacement !== undefined) replaced = text.replace(new RegExp(pattern, flags), replacement)
    self.postMessage({ ok: true, matches, truncated: matches.length >= cap, replaced })
  } catch (err) { self.postMessage({ ok: false, error: (err as Error).message }) }
}
