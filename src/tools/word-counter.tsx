import { useMemo, useState } from 'react'
import { Grid, Panel, Stat, Textarea } from '@/components/kit'
import { wordStats } from '@/lib/text'

export default function WordCounter() {
  const [t, setT] = useState('')
  const s = useMemo(() => wordStats(t), [t])
  const mins = (m: number) => (m < 1 ? `${Math.round(m * 60)} sec` : `${m.toFixed(1)} min`)
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Text"><Textarea aria-label="Text" value={t} onChange={(e) => setT(e.target.value)} rows={12} className="w-full" placeholder="Type or paste text — counts update live." /></Panel>
      <Grid cols={4}><Stat label="Words" value={s.words.toLocaleString()} /><Stat label="Characters" value={s.chars.toLocaleString()} /><Stat label="Chars (no spaces)" value={s.charsNoSpaces.toLocaleString()} /><Stat label="Lines" value={s.lines} />
        <Stat label="Sentences" value={s.sentences} /><Stat label="Paragraphs" value={s.paragraphs} /><Stat label="Reading time" value={mins(s.readMin)} /><Stat label="Speaking time" value={mins(s.speakMin)} /></Grid>
      {s.top.length > 0 && <Panel title="Most frequent words"><div className="flex flex-wrap gap-1.5">{s.top.map(([w, n]) => <span key={w} className="rounded-full border px-2.5 py-0.5 text-xs">{w} <b className="text-primary">×{n}</b></span>)}</div></Panel>}
    </div>
  )
}
