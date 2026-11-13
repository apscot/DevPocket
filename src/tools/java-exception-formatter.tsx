import { useMemo, useState } from 'react'
import { Check_, CopyButton, Empty, Field, Grid, Input, InputPane, Notice, OutputPane, Panel, Stat } from '@/components/kit'
import { ExcCard } from '@/components/TraceView'
import { formatTrace, parseTrace, simpleName } from '@/lib/javatrace'
import { SAMPLE_STACK } from '@/lib/samples'

export default function JavaExceptionFormatter() {
  const [t, setT] = useState(''); const [hide, setHide] = useState(true); const [app, setApp] = useState('')
  const r = useMemo(() => (t.trim() ? parseTrace(t, app) : null), [t, app])
  const plain = r ? formatTrace(r, { hideFramework: hide }) : ''
  const root = r?.items.filter((i) => i.groupIndex === 0).at(-1)
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <InputPane value={t} onChange={setT} sample={SAMPLE_STACK} placeholder="Paste a Java exception / log excerpt…" />
        <div className="flex min-w-0 flex-col gap-3">
          <Panel title="Options"><div className="flex flex-wrap items-end gap-4"><Check_ label="Hide framework frames" checked={hide} onChange={setHide} /><Field label="Your app package (optional)"><Input value={app} onChange={(e) => setApp(e.target.value)} placeholder="com.example" className="w-44" /></Field></div></Panel>
          {r && !r.items.length && <Notice kind="warn">No exception header found. Expected a line like <code>java.lang.IllegalStateException: message</code> followed by <code>at …</code> frames.</Notice>}
          {r && root && <Notice kind="error"><b>Root cause:</b> <span className="mono">{simpleName(root.type)}</span>{root.message ? ` — ${root.message.split('\n')[0]}` : ''}</Notice>}
          {r && r.items.length > 0 && <Grid cols={3}><Stat label="Exceptions" value={r.items.length} /><Stat label="Chain depth" value={r.items.filter((i) => i.groupIndex === 0).length} /><Stat label="Frames" value={r.items.reduce((n, i) => n + i.frames.length, 0)} /></Grid>}
        </div>
      </div>
      {!r ? <Empty>Paste a Java exception or a log snippet containing one. Cause chains, messages and frames are detected automatically.</Empty> : r.items.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Cause chain" className="min-w-0"><div className="flex flex-col gap-2">{r.items.map((e, i) => <ExcCard key={i} e={e} q="" hideFramework={hide} index={i} showFrames={false} />)}</div></Panel>
          <OutputPane title="Formatted text" value={plain} filename="exception.txt" rows={16} />
        </div>
      )}
    </div>
  )
}
