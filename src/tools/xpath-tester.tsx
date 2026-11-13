import { useEffect, useState } from 'react'
import { Empty, Field, Input, InputPane, Notice, Panel, Stat, Grid, CopyButton } from '@/components/kit'

const XML = `<?xml version="1.0"?>
<catalog xmlns:bk="http://example.com/books">
  <book id="b1" lang="en"><title>Clean Code</title><price>33.99</price></book>
  <book id="b2" lang="de"><title>Refactoring</title><price>45.00</price></book>
  <bk:magazine id="m1"><title>DevOps Weekly</title></bk:magazine>
</catalog>`
const NODE_NAMES: Record<number, string> = { 1: 'element', 2: 'attribute', 3: 'text', 4: 'cdata', 7: 'processing-instruction', 8: 'comment', 9: 'document' }
export default function XPathTester() {
  const [xml, setXml] = useState(''); const [expr, setExpr] = useState('//book[price > 40]/title/text()')
  const [state, setState] = useState<{ items: { type: string; text: string; path?: string }[]; kind: string; err: string } | null>(null)
  useEffect(() => { void (async () => {
    if (!xml.trim() || !expr.trim()) { setState(null); return }
    try {
      const [{ DOMParser, XMLSerializer }, xp] = await Promise.all([import('@xmldom/xmldom'), import('xpath')])
      const errors: string[] = []
      const doc = new DOMParser({ onError: (lvl: string, msg: string) => { if (lvl !== 'warning') errors.push(msg) } } as never).parseFromString(xml, 'text/xml')
      if (errors.length || !doc.documentElement) throw new Error('Invalid XML: ' + (errors[0] ?? 'no root element').split('\n')[0])
      const ns: Record<string, string> = {}; const root = doc.documentElement
      for (let i = 0; i < root.attributes.length; i++) { const a = root.attributes[i]; if (a.name.startsWith('xmlns:')) ns[a.name.slice(6)] = a.value }
      const sel = xp.useNamespaces(ns)
      const r = sel(expr, doc as never) as unknown
      const ser = new XMLSerializer()
      if (Array.isArray(r)) setState({ kind: `node-set (${r.length})`, err: '', items: r.map((n: any) => ({ type: NODE_NAMES[n.nodeType] ?? String(n.nodeType), text: n.nodeType === 2 ? `${n.name}="${n.value}"` : n.nodeType === 3 || n.nodeType === 4 ? n.data : ser.serializeToString(n) })) })
      else setState({ kind: typeof r, err: '', items: [{ type: typeof r, text: String(r) }] })
    } catch (e) { setState({ kind: '', items: [], err: (e as Error).message }) }
  })() }, [xml, expr])
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <InputPane title="XML" value={xml} onChange={setXml} sample={XML} accept=".xml,text/xml" rows={16} />
      <div className="flex min-w-0 flex-col gap-3">
        <Panel title="XPath 1.0 expression"><Field label="Expression"><Input value={expr} onChange={(e) => setExpr(e.target.value)} className="mono" aria-label="XPath expression" /></Field><p className="mt-1.5 text-[11px] text-muted-foreground">Namespace prefixes declared on the root element are available (e.g. //bk:magazine). Evaluation is local using XPath 1.0.</p></Panel>
        {state?.err && <Notice kind="error">{state.err}</Notice>}
        {!state && <Empty>Provide XML and an XPath expression.</Empty>}
        {state && !state.err && <><Grid cols={2}><Stat label="Result type" value={state.kind} /><Stat label="Results" value={state.items.length} /></Grid>
          <Panel title="Results">{state.items.length ? <ol className="space-y-2" data-testid="xpath-results">{state.items.map((it, i) => <li key={i} className="rounded-md border bg-background p-2"><div className="mb-1 flex items-center gap-2 text-[11px] uppercase text-muted-foreground"><span>{i + 1} · {it.type}</span><span className="ml-auto"><CopyButton text={it.text} size="icon" label="Copy result" /></span></div><pre className="mono whitespace-pre-wrap break-all text-xs">{it.text}</pre></li>)}</ol> : <Empty>The expression matched nothing.</Empty>}</Panel></>}
      </div>
    </div>
  )
}
