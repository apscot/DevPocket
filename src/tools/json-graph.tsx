import { useState } from 'react'
import { Empty, InputPane, Notice, Panel, SearchBox, useDebounced } from '@/components/kit'
import { JsonTree } from '@/components/JsonTree'
import { useParsedJson } from '@/hooks/useParsedJson'
import { SAMPLE_JSON } from '@/lib/samples'

export default function JsonGraph() {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const { data, error, empty } = useParsedJson(text)
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(280px,2fr)_3fr]">
      <InputPane value={text} onChange={setText} sample={SAMPLE_JSON} accept=".json" />
      <Panel title="Node tree" actions={<SearchBox value={q} onChange={setQ} placeholder="Search nodes" className="w-56" />}>
        {error ? <Notice kind="error">{error}</Notice> : empty ? <Empty>Paste JSON to browse it as a collapsible tree. Large documents are virtualized.</Empty> : <JsonTree data={data} variant="graph" search={dq} initialDepth={2} />}
      </Panel>
    </div>
  )
}
