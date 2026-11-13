import { useMemo, useState } from 'react'
import { Empty, Grid, InputPane, Notice, Panel, SearchBox, Stat } from '@/components/kit'
import { jsonStats, type JType } from '@/lib/json'
import { useParsedJson } from '@/hooks/useParsedJson'
import { SAMPLE_JSON } from '@/lib/samples'

export default function JsonExplorer() {
  const [text, setText] = useState(''); const [q, setQ] = useState('')
  const { data, error, empty } = useParsedJson(text)
  const st = useMemo(() => (empty || error ? null : jsonStats(data)), [data, error, empty])
  const paths = (st?.paths ?? []).filter((p) => !q || p.path.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(280px,2fr)_3fr]">
      <InputPane value={text} onChange={setText} sample={SAMPLE_JSON} accept=".json" />
      <div className="flex min-w-0 flex-col gap-3">
        {error && <Notice kind="error">{error}</Notice>}
        {!st ? <Empty>Paste JSON to see statistics: node counts, depth, key frequency, type distribution and all JSON paths.</Empty> : (
          <>
            <Grid cols={4}><Stat label="Total nodes" value={st.totalNodes.toLocaleString()} /><Stat label="Max depth" value={st.maxDepth} /><Stat label="Objects" value={st.objects} /><Stat label="Arrays" value={st.arrays} /></Grid>
            <Grid cols={4}><Stat label="Keys" value={st.keys} /><Stat label="Unique keys" value={st.uniqueKeys} /><Stat label="Largest array" value={st.largestArray ? `${st.largestArray.length}` : '—'} /><Stat label="Avg array len" value={st.avgArrayLength.toFixed(1)} /></Grid>
            <Panel title="Type distribution"><div className="space-y-1.5">{(Object.keys(st.types) as JType[]).map((t) => (
              <div key={t} className="flex items-center gap-2 text-sm"><span className="w-16 text-muted-foreground">{t}</span><div className="h-2 flex-1 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(st.types[t] / st.totalNodes) * 100}%` }} /></div><span className="mono w-12 text-right">{st.types[t]}</span></div>))}</div></Panel>
            <Panel title="Most frequent keys"><div className="flex flex-wrap gap-1.5">{st.topKeys.map(([k, n]) => <span key={k} className="mono rounded border px-2 py-0.5 text-xs">{k} <b className="text-primary">×{n}</b></span>)}</div>
              {st.longestString && <p className="mt-3 text-xs text-muted-foreground">Longest string: {st.longestString.length} chars at <code className="mono">{st.longestString.path}</code></p>}</Panel>
            <Panel title={`Paths (${paths.length})`} actions={<SearchBox value={q} onChange={setQ} placeholder="Filter paths" className="w-48" />}>
              <ul className="mono scroll-thin max-h-72 overflow-auto text-xs">{paths.slice(0, 500).map((p) => <li key={p.path} className="flex justify-between gap-3 border-b py-1"><span className="break-all">{p.path}</span><span className="text-muted-foreground">{p.type}</span></li>)}</ul>
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}
