import { useMemo, useState } from 'react'
import { Check_, CopyButton, Empty, Field, Grid, Input, InputPane, Notice, Panel, SearchBox, Stat } from '@/components/kit'
import { ExcCard } from '@/components/TraceView'
import { formatTrace, parseTrace } from '@/lib/javatrace'
import { SAMPLE_STACK } from '@/lib/samples'

export default function JavaStackTrace() {
  const [t, setT] = useState(''); const [hide, setHide] = useState(false); const [app, setApp] = useState('com.example'); const [q, setQ] = useState('')
  const r = useMemo(() => (t.trim() ? parseTrace(t, app) : null), [t, app])
  const groups = useMemo(() => { const m = new Map<number, typeof r extends null ? never : NonNullable<typeof r>['items']>(); r?.items.forEach((e) => { const g = m.get(e.groupIndex) ?? []; g.push(e); m.set(e.groupIndex, g) }); return [...m.values()] }, [r])
  const frames = r?.items.reduce((n, i) => n + i.frames.length, 0) ?? 0
  const appFrames = r?.items.reduce((n, i) => n + i.frames.filter((f) => !f.framework).length, 0) ?? 0
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(280px,2fr)_3fr]">
      <InputPane value={t} onChange={setT} sample={SAMPLE_STACK} placeholder="Paste a stack trace…" />
      <div className="flex min-w-0 flex-col gap-3">
        <Panel title="Options" actions={r && <CopyButton text={formatTrace(r, { hideFramework: hide })} label="Copy formatted" />}>
          <div className="flex flex-wrap items-end gap-4"><SearchBox value={q} onChange={setQ} placeholder="Search trace" className="w-48" /><Check_ label="Hide framework frames" checked={hide} onChange={setHide} /><Field label="Application package"><Input value={app} onChange={(e) => setApp(e.target.value)} className="w-40" placeholder="com.example" /></Field></div>
        </Panel>
        {!r ? <Empty>Paste a stack trace. Application frames are emphasized; framework frames are dimmed. “Caused by” sections are grouped.</Empty> : !r.items.length ? <Notice kind="warn">No stack trace detected in this text.</Notice> : (
          <>
            <Grid cols={4}><Stat label="Traces" value={groups.length} /><Stat label="Exceptions" value={r.items.length} /><Stat label="Frames" value={frames} /><Stat label="App frames" value={appFrames} tone="ok" /></Grid>
            {groups.map((g, gi) => <div key={gi} className="flex flex-col gap-2">{g.map((e, i) => <ExcCard key={i} e={e} q={q} hideFramework={hide} index={gi * 100 + i} />)}</div>)}
          </>
        )}
      </div>
    </div>
  )
}
