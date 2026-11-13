import { useMemo, useState } from 'react'
import { Check_, CopyButton, Empty, Grid, InputPane, Notice, OutputPane, Panel, Stat } from '@/components/kit'
import { cleanInvisible, findInvisible, visualize } from '@/lib/text'

const SAMPLE = 'Hello\u200bWorld\u00a0with\u00a0nbsp\ttab\r\nzero\u200d\u200cwidth\u2028and\ufeffBOM\u202eRTL   \nnormal line'
export default function InvisibleChars() {
  const [t, setT] = useState(''); const [keepNbsp, setKeepNbsp] = useState(false); const [eol, setEol] = useState(true); const [trim, setTrim] = useState(false)
  const r = useMemo(() => findInvisible(t), [t])
  const counts = useMemo(() => { const m = new Map<string, { n: number; name: string; cp: number }>(); r.found.forEach((f) => { const k = f.label; const e = m.get(k); if (e) e.n++; else m.set(k, { n: 1, name: f.name, cp: f.cp }) }); return [...m] }, [r])
  const cleaned = useMemo(() => cleanInvisible(t, { keepNbsp, normalizeEol: eol ? 'lf' : '', trimTrailing: trim }), [t, keepNbsp, eol, trim])
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <InputPane value={t} onChange={setT} sample={SAMPLE} placeholder="Paste text to inspect…" />
        <div className="flex min-w-0 flex-col gap-3">
          {!t ? <Empty>Paste text to reveal zero-width characters, odd spaces, control characters and line-ending differences.</Empty> : (<>
            <Grid cols={4}><Stat label="Hidden chars" value={r.found.length} tone={r.found.length ? 'warn' : 'ok'} /><Stat label="LF lines" value={r.eol.lf} /><Stat label="CRLF lines" value={r.eol.crlf} /><Stat label="CR only" value={r.eol.cr} /></Grid>
            {r.eol.lf && r.eol.crlf ? <Notice kind="warn">Mixed line endings detected (LF and CRLF).</Notice> : null}
            {r.trailing > 0 && <Notice kind="info">{r.trailing} line{r.trailing > 1 ? 's' : ''} with trailing whitespace.</Notice>}
            <Panel title="Characters found">{counts.length ? <table className="w-full text-sm"><tbody>{counts.map(([l, v]) => <tr key={l} className="border-t"><td className="mono w-20 py-1 text-primary">{l}</td><td>{v.name}</td><td className="mono text-xs text-muted-foreground">U+{v.cp.toString(16).toUpperCase().padStart(4, '0')}</td><td className="text-right font-semibold">×{v.n}</td></tr>)}</tbody></table> : <p className="text-sm text-success">No invisible or unusual characters found.</p>}</Panel>
          </>)}
        </div>
      </div>
      {t && (<>
        <Panel title="Visualized" actions={<CopyButton text={visualize(t)} />}><pre className="mono max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3 text-[13px]" data-testid="visualized">{visualize(t)}</pre><p className="mt-1 text-[11px] text-muted-foreground">· space   → tab   ␊ LF   ␍ CR   ⟦ZWSP⟧ etc. mark hidden characters.</p></Panel>
        <Panel title="Cleaning options"><div className="flex flex-wrap gap-4"><Check_ label="Keep non-breaking spaces" checked={keepNbsp} onChange={setKeepNbsp} /><Check_ label="Normalize line endings to LF" checked={eol} onChange={setEol} /><Check_ label="Trim trailing whitespace" checked={trim} onChange={setTrim} /></div></Panel>
        <OutputPane title="Cleaned text" value={cleaned} filename="cleaned.txt" rows={8} />
      </>)}
    </div>
  )
}
