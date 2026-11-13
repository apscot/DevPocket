import { useEffect, useState } from 'react'
import { Check_, CopyButton, FileButton, Grid, Notice, Panel, Tabs, Textarea, Select } from '@/components/kit'
import { digest, type HashAlg } from '@/lib/security'
import { bytesToB64, bytesToHex, utf8 } from '@/lib/encode'
import { fmtBytes } from '@/lib/util'

const ALGS: HashAlg[] = ['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1']
export default function HashGenerator() {
  const [tab, setTab] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [upper, setUpper] = useState(false); const [fmt, setFmt] = useState('hex')
  const [out, setOut] = useState<Record<string, Uint8Array>>({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        setBusy(true); setErr('')
        const data = tab === 'text' ? utf8(text) : file ? new Uint8Array(await file.arrayBuffer()) : null
        if (!data) { if (live) setOut({}); return }
        const res = Object.fromEntries(await Promise.all(ALGS.map(async (a) => [a, await digest(a, data as BufferSource)])))
        if (live) setOut(res)
      } catch (e) { if (live) setErr((e as Error).message) } finally { if (live) setBusy(false) }
    })()
    return () => { live = false }
  }, [tab, text, file])
  const show = (b: Uint8Array) => (fmt === 'hex' ? (upper ? bytesToHex(b).toUpperCase() : bytesToHex(b)) : bytesToB64(b))
  return (
    <div className="flex flex-col gap-3">
      <Notice kind="info">Uses the browser’s Web Crypto API. <b>SHA-256 / SHA-384 / SHA-512</b> are recommended. SHA-1 is shown for legacy checksums only and is <b>not collision-resistant</b>. MD5 is not available in Web Crypto and is intentionally not offered.</Notice>
      <Tabs value={tab} onChange={setTab} items={[['text', 'Text'], ['file', 'File']]} />
      <Panel title={tab === 'text' ? 'Text' : 'File'} actions={tab === 'file' ? <FileButton label="Choose file" onFile={setFile} /> : undefined}>
        {tab === 'text' ? <Textarea aria-label="Text to hash" value={text} onChange={(e) => setText(e.target.value)} rows={6} className="w-full" placeholder="Text to hash (UTF-8)…" /> : <p className="text-sm text-muted-foreground">{file ? `${file.name} · ${fmtBytes(file.size)}` : 'Choose a file to hash locally.'}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-4"><Select value={fmt} onChange={(e) => setFmt(e.target.value)} className="w-36" aria-label="Output encoding"><option value="hex">Hex</option><option value="b64">Base64</option></Select>{fmt === 'hex' && <Check_ label="Uppercase" checked={upper} onChange={setUpper} />}{busy && <span className="text-xs text-muted-foreground">Hashing…</span>}</div>
      </Panel>
      {err && <Notice kind="error">{err}</Notice>}
      <Grid cols={1}>{ALGS.map((a) => out[a] && (
        <div key={a} className="flex items-start gap-3 rounded-lg border bg-card p-3"><span className="w-20 shrink-0 text-sm font-semibold">{a}{a === 'SHA-1' && <span className="block text-[10px] font-normal text-warning">legacy</span>}</span><code className="mono min-w-0 flex-1 break-all text-sm" data-testid={`hash-${a}`}>{show(out[a])}</code><CopyButton text={show(out[a])} size="icon" label={`Copy ${a}`} /></div>))}</Grid>
    </div>
  )
}
