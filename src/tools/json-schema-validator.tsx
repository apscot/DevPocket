import { useMemo, useState } from 'react'
import { Notice, Panel, Select, Textarea, Button, Stat, Grid, Field, CopyButton, Empty } from '@/components/kit'
import { parseJson, pointerLines } from '@/lib/json'
import { cn } from '@/lib/cn'

const SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id", "email", "age"],
  "properties": {
    "id": { "type": "integer", "minimum": 1 },
    "email": { "type": "string", "format": "email" },
    "age": { "type": "integer", "minimum": 0, "maximum": 150 },
    "tags": { "type": "array", "items": { "type": "string" }, "uniqueItems": true }
  },
  "additionalProperties": false
}`
const DATA = `{
  "id": 0,
  "email": "not-an-email",
  "tags": ["a", "a"],
  "extra": true
}`
type Err = { instancePath: string; message?: string; schemaPath: string; keyword: string; params: Record<string, unknown> }

async function makeAjv(draft: string) {
  const [{ default: formats }] = await Promise.all([import('ajv-formats')])
  const mod = draft === '2020' ? await import('ajv/dist/2020') : draft === '2019' ? await import('ajv/dist/2019') : await import('ajv')
  const Ajv = (mod as any).default
  const ajv = new Ajv({ allErrors: true, strict: false })
  ;(formats as any)(ajv)
  return ajv
}

export default function JsonSchemaValidator() {
  const [schema, setSchema] = useState('')
  const [data, setData] = useState('')
  const [draft, setDraft] = useState('2020')
  const [res, setRes] = useState<{ valid: boolean; errors: Err[]; formatted: string } | null>(null)
  const [fatal, setFatal] = useState('')
  const run = async () => {
    setFatal(''); setRes(null)
    try {
      const s = parseJson(schema); const d = parseJson(data)
      const ajv = await makeAjv(draft)
      const v = ajv.compile(s as object)
      const valid = v(d) as boolean
      setRes({ valid, errors: (v.errors ?? []) as Err[], formatted: JSON.stringify(d, null, 2) })
    } catch (e) { setFatal(`${(e as Error).message}`) }
  }
  const lines = useMemo(() => (res ? pointerLines(res.formatted) : new Map<string, number>()), [res])
  const bad = useMemo(() => new Map((res?.errors ?? []).map((e) => [lines.get(e.instancePath) ?? 1, e])), [res, lines])
  const fmtErr = (e: Err) => `${e.instancePath || '(root)'}: ${e.message}${e.params && Object.keys(e.params).length ? ' ' + JSON.stringify(e.params) : ''}`
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="JSON Schema draft"><Select value={draft} onChange={(e) => setDraft(e.target.value)} className="w-48"><option value="2020">2020-12</option><option value="2019">2019-09</option><option value="07">Draft-07</option></Select></Field>
        <Button variant="default" onClick={run} data-testid="validate">Validate</Button>
        <Button onClick={() => { setSchema(SCHEMA); setData(DATA) }}>Load sample</Button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Schema"><Textarea aria-label="Schema" value={schema} onChange={(e) => setSchema(e.target.value)} rows={14} className="w-full" placeholder="Paste JSON Schema" /></Panel>
        <Panel title="JSON data"><Textarea aria-label="Data" value={data} onChange={(e) => setData(e.target.value)} rows={14} className="w-full" placeholder="Paste JSON to validate" /></Panel>
      </div>
      {fatal && <Notice kind="error">{fatal}</Notice>}
      {!res && !fatal && <Empty>Paste a schema and data, then press Validate.</Empty>}
      {res && (
        <>
          <Grid cols={3}><Stat label="Result" value={res.valid ? 'Valid' : 'Invalid'} tone={res.valid ? 'ok' : 'bad'} /><Stat label="Errors" value={res.errors.length} /><Stat label="Draft" value={draft === '2020' ? '2020-12' : draft === '2019' ? '2019-09' : '07'} /></Grid>
          {res.valid ? <Notice kind="success">Data conforms to the schema.</Notice> : (
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel title="Errors" actions={<CopyButton text={res.errors.map(fmtErr).join('\n')} />}>
                <ul className="space-y-1.5 text-sm">{res.errors.map((e, i) => <li key={i} className="rounded-md border border-destructive/30 bg-destructive/5 p-2"><code className="mono text-destructive">{e.instancePath || '(root)'}</code> <span>{e.message}</span><div className="mono text-[11px] text-muted-foreground">{e.keyword} · {e.schemaPath}</div></li>)}</ul>
              </Panel>
              <Panel title="Data with highlighted paths">
                <pre className="mono scroll-thin max-h-[420px] overflow-auto rounded-md border bg-background py-1">{res.formatted.split('\n').map((l, i) => (
                  <div key={i} className={cn('flex px-2', bad.has(i + 1) && 'bg-destructive/10')} title={bad.get(i + 1) ? fmtErr(bad.get(i + 1)!) : undefined}><span className="w-8 shrink-0 select-none text-right text-muted-foreground">{i + 1}</span><span className="pl-3 whitespace-pre">{l}</span></div>))}</pre>
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  )
}
