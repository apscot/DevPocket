import { useMemo, useState } from 'react'
import { Check_, Empty, Field, InputPane, Notice, OutputPane, Panel, Select } from '@/components/kit'
import { detectDelimiter, parseCsv } from '@/lib/csv'
import { toMarkdownTable } from '@/lib/text'
import { SAMPLE_CSV } from '@/lib/samples'

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
export default function MarkdownTable() {
  const [t, setT] = useState(''); const [delim, setDelim] = useState('auto'); const [header, setHeader] = useState(true); const [pretty, setPretty] = useState(true)
  const [aligns, setAligns] = useState<Record<number, 'l' | 'c' | 'r'>>({}); const [def, setDef] = useState<'l' | 'c' | 'r'>('l')
  const res = useMemo(() => {
    if (!t.trim()) return null
    try { const rows = parseCsv(t, delim === 'auto' ? detectDelimiter(t) : delim); const cols = Math.max(0, ...rows.map((r) => r.length)); const al = Array.from({ length: cols }, (_, i) => aligns[i] ?? def); return { rows, al, md: toMarkdownTable(rows, { header, align: al, pretty }), err: '' } } catch (e) { return { rows: [], al: [], md: '', err: (e as Error).message } }
  }, [t, delim, header, pretty, aligns, def])
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <InputPane value={t} onChange={setT} sample={SAMPLE_CSV} accept=".csv,.tsv,.txt" placeholder="Paste CSV or tab-separated text (e.g. copied from a spreadsheet)" />
        <div className="flex min-w-0 flex-col gap-3">
          <Panel title="Options"><div className="flex flex-wrap items-end gap-4"><Field label="Delimiter"><Select value={delim} onChange={(e) => setDelim(e.target.value)} className="w-36"><option value="auto">Auto</option><option value=",">Comma</option><option value={'\t'}>Tab</option><option value=";">Semicolon</option><option value="|">Pipe</option></Select></Field><Field label="Default alignment"><Select value={def} onChange={(e) => { setDef(e.target.value as 'l'); setAligns({}) }} className="w-32"><option value="l">Left</option><option value="c">Center</option><option value="r">Right</option></Select></Field><Check_ label="First row is header" checked={header} onChange={setHeader} /><Check_ label="Pad columns" checked={pretty} onChange={setPretty} /></div>
            {res && res.al.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{res.al.map((a, i) => <Field key={i} label={`Col ${i + 1}`}><Select value={a} onChange={(e) => setAligns({ ...aligns, [i]: e.target.value as 'l' })} className="h-8 w-24"><option value="l">Left</option><option value="c">Center</option><option value="r">Right</option></Select></Field>)}</div>}</Panel>
          {res?.err && <Notice kind="error">{res.err}</Notice>}
          <OutputPane title="Markdown" value={res?.md ?? ''} filename="table.md" mime="text/markdown" rows={9} />
        </div>
      </div>
      {!res ? <Empty>Paste CSV or TSV to generate a Markdown table.</Empty> : res.rows.length > 0 && <Panel title="Preview"><div className="scroll-thin overflow-auto"><table className="md-prev text-sm"><thead><tr>{(header ? res.rows[0] : res.al.map((_, i) => `Column ${i + 1}`)).map((h, i) => <th key={i} style={{ textAlign: res.al[i] === 'c' ? 'center' : res.al[i] === 'r' ? 'right' : 'left' }} dangerouslySetInnerHTML={{ __html: esc(h) }} />)}</tr></thead><tbody>{(header ? res.rows.slice(1) : res.rows).map((r, ri) => <tr key={ri}>{res.al.map((_, i) => <td key={i} style={{ textAlign: res.al[i] === 'c' ? 'center' : res.al[i] === 'r' ? 'right' : 'left' }}>{r[i] ?? ''}</td>)}</tr>)}</tbody></table></div></Panel>}
    </div>
  )
}
