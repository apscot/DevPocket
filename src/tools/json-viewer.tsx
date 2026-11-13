import { useState } from 'react'
import { Empty, InputPane, Notice, Panel, SearchBox, useDebounced } from '@/components/kit'
import { JsonTree } from '@/components/JsonTree'
import { useParsedJson } from '@/hooks/useParsedJson'
import { SAMPLE_JSON } from '@/lib/samples'

export default function JsonViewer() {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const { data, error, empty } = useParsedJson(text)
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(280px,2fr)_3fr]">
      <InputPane value={text} onChange={setText} sample={SAMPLE_JSON} accept=".json" />
      <Panel title="Tree" actions={<SearchBox value={q} onChange={setQ} placeholder="Search keys and values" className="w-56" />}>
        {error ? <Notice kind="error">{error}</Notice> : empty ? <Empty>Paste JSON to explore it as a tree. Hover a row to copy its JSON path or value.</Empty> : <JsonTree data={data} search={dq} />}
      </Panel>
    </div>
  )
}
