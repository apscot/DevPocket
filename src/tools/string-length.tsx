import { useMemo, useState } from 'react'
import { Grid, Panel, Stat, Textarea, Notice } from '@/components/kit'

export function textStats(s: string) {
  const cps = [...s]
  let graphemes = cps.length
  try { graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].length } catch { /* unsupported */ }
  const enc = new TextEncoder()
  return {
    codePoints: cps.length, graphemes, utf16: s.length, utf8: enc.encode(s).length, utf16Bytes: s.length * 2,
    words: (s.match(/\S+/g) ?? []).length, lines: s === '' ? 0 : s.split(/\r\n|\r|\n/).length,
    nonAscii: cps.filter((c) => c.codePointAt(0)! > 127).length, astral: cps.filter((c) => c.codePointAt(0)! > 0xffff).length,
    noSpaces: cps.filter((c) => !/\s/.test(c)).length,
  }
}
export default function StringLength() {
  const [t, setT] = useState('')
  const st = useMemo(() => textStats(t), [t])
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Text"><Textarea aria-label="Text" value={t} onChange={(e) => setT(e.target.value)} rows={8} className="w-full" placeholder="Type or paste text, e.g. héllo 👨‍👩‍👧 世界" /></Panel>
      <Grid cols={4}>
        <Stat label="Characters (code points)" value={st.codePoints} /><Stat label="Grapheme clusters" value={st.graphemes} /><Stat label="UTF-16 units (JS .length)" value={st.utf16} /><Stat label="UTF-8 bytes" value={st.utf8} />
        <Stat label="UTF-16 bytes" value={st.utf16Bytes} /><Stat label="Words" value={st.words} /><Stat label="Lines" value={st.lines} /><Stat label="Chars w/o whitespace" value={st.noSpaces} />
        <Stat label="Non-ASCII chars" value={st.nonAscii} /><Stat label="Astral (surrogate pairs)" value={st.astral} />
      </Grid>
      {st.utf16 !== st.codePoints && <Notice kind="info">JavaScript’s <code>.length</code> counts UTF-16 code units ({st.utf16}); this text has {st.codePoints} Unicode code points because some characters (e.g. emoji) need surrogate pairs. Java’s <code>String.length()</code> also returns UTF-16 units.</Notice>}
    </div>
  )
}
