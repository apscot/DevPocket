import { useState } from 'react'
import { Button, Check_, CopyButton, DownloadButton, Field, Input, Panel, Select } from '@/components/kit'

const make = (n: number) => Array.from({ length: n }, () => crypto.randomUUID())
export default function UuidGenerator() {
  const [count, setCount] = useState(5); const [upper, setUpper] = useState(false); const [dashes, setDashes] = useState(true); const [braces, setBraces] = useState(false); const [sep, setSep] = useState('\n')
  const [list, setList] = useState(() => make(5))
  const fmt = (u: string) => { let x = dashes ? u : u.replace(/-/g, ''); if (upper) x = x.toUpperCase(); return braces ? `{${x}}` : x }
  const shown = list.map(fmt); const all = shown.join(sep)
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Options"><div className="flex flex-wrap items-end gap-4">
        <Field label="How many (1–1000)"><Input type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))} className="w-28" aria-label="Count" /></Field>
        <Field label="Separator"><Select value={sep} onChange={(e) => setSep(e.target.value)} className="w-32"><option value={'\n'}>New line</option><option value=",">Comma</option><option value=", ">Comma + space</option><option value=" ">Space</option></Select></Field>
        <Check_ label="Uppercase" checked={upper} onChange={setUpper} /><Check_ label="Hyphens" checked={dashes} onChange={setDashes} /><Check_ label="Braces" checked={braces} onChange={setBraces} />
        <Button variant="default" onClick={() => setList(make(count))} data-testid="gen-uuid">Generate</Button>
      </div></Panel>
      <Panel title={`UUID v4 (${shown.length})`} actions={<><CopyButton text={all} label="Copy all" /><DownloadButton text={all} filename="uuids.txt" /></>}>
        <ul className="mono max-h-80 space-y-1 overflow-auto text-sm scroll-thin">{shown.map((u, i) => <li key={i} className="flex items-center gap-2 rounded border px-2 py-1"><span className="min-w-0 flex-1 break-all" data-testid="uuid-item">{u}</span><CopyButton text={u} size="icon" label={`Copy ${u}`} /></li>)}</ul>
        <p className="mt-2 text-[11px] text-muted-foreground">Generated with crypto.randomUUID() (cryptographically secure).</p>
      </Panel>
    </div>
  )
}
