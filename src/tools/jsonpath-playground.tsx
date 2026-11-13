import { useMemo, useState } from 'react'
import { JSONPath } from 'jsonpath-plus'
import { Empty, Field, Input, InputPane, Notice, OutputPane, Panel, Stat, Grid } from '@/components/kit'
import { useParsedJson } from '@/hooks/useParsedJson'
import { SAMPLE_JSON } from '@/lib/samples'

const EXAMPLES = ['$.name', '$.orders[*].total', '$..sku', '$.orders[?(@.total > 10)]', '$.orders[0:1].id', '$..*', '$.address.geo', '$.tags[-1:]']
export default function JsonPathPlayground() {
  const [text, setText] = useState(''); const [path, setPath] = useState('$.orders[?(@.total > 10)].id')
  const { data, error, empty } = useParsedJson(text)
  const res = useMemo(() => {
    if (empty || error || !path.trim()) return null
    try { const r = JSONPath({ path, json: data as object, resultType: 'all' }) as { path: string; value: unknown }[]; return { items: r ?? [], err: '' } } catch (e) { return { items: [], err: (e as Error).message } }
  }, [data, error, empty, path])
  const out = res ? JSON.stringify(res.items.map((i) => i.value), null, 2) : ''
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <InputPane value={text} onChange={setText} sample={SAMPLE_JSON} accept=".json" rows={18} />
      <div className="flex min-w-0 flex-col gap-3">
        {error && <Notice kind="error">{error}</Notice>}
        <Panel title="JSONPath"><Field label="Expression"><Input value={path} onChange={(e) => setPath(e.target.value)} className="mono" aria-label="JSONPath expression" /></Field><div className="mt-2 flex flex-wrap gap-1.5">{EXAMPLES.map((x) => <button key={x} onClick={() => setPath(x)} className="mono cursor-pointer rounded border px-2 py-0.5 text-xs hover:bg-muted">{x}</button>)}</div>
          <p className="mt-2 text-[11px] text-muted-foreground">Supports $ . .. * [n] [start:end] [?(@.prop &gt; 1)] unions. Filter scripts run in a restricted (safe) evaluator.</p></Panel>
        {res?.err && <Notice kind="error">Could not evaluate: {res.err}. Check brackets, quotes and filter syntax.</Notice>}
        {!res && !error && <Empty>Paste JSON and enter a JSONPath expression.</Empty>}
        {res && !res.err && (<><Grid cols={2}><Stat label="Matches" value={res.items.length} tone={res.items.length ? 'ok' : 'warn'} /><Stat label="Input valid" value="Yes" /></Grid>
          <OutputPane title="Result values" value={out} filename="result.json" mime="application/json" rows={10} />
          {res.items.length > 0 && <Panel title="Matched paths"><ul className="mono max-h-40 overflow-auto text-xs">{res.items.slice(0, 200).map((i, k) => <li key={k} className="border-b py-0.5">{i.path}</li>)}</ul></Panel>}</>)}
      </div>
    </div>
  )
}
