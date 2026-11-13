import { useState } from 'react'
import { Button, Field, Grid, Input, Notice, Panel, Select, Textarea, CopyButton, Stat } from '@/components/kit'
import { hmacSign, hmacVerify, type HashAlg } from '@/lib/security'
import { b64ToBytes, bytesToB64, bytesToHex, hexToBytes, utf8 } from '@/lib/encode'

const dec = (s: string, f: string) => (f === 'hex' ? hexToBytes(s) : f === 'b64' ? b64ToBytes(s) : utf8(s))
export default function HmacTool() {
  const [msg, setMsg] = useState(''); const [key, setKey] = useState(''); const [keyFmt, setKeyFmt] = useState('text'); const [alg, setAlg] = useState<HashAlg>('SHA-256')
  const [sig, setSig] = useState(''); const [sigFmt, setSigFmt] = useState('hex')
  const [res, setRes] = useState<{ hex: string; b64: string; ok?: boolean } | null>(null); const [err, setErr] = useState('')
  const run = async () => {
    setErr(''); setRes(null)
    try {
      if (!key) throw new Error('Enter a secret key.')
      const k = dec(key, keyFmt), m = utf8(msg)
      const s = await hmacSign(alg, k, m)
      let ok: boolean | undefined
      if (sig.trim()) ok = await hmacVerify(alg, k, m, dec(sig.trim(), sigFmt))
      setRes({ hex: bytesToHex(s), b64: bytesToB64(s), ok })
    } catch (e) { setErr((e as Error).message) }
  }
  return (
    <div className="flex flex-col gap-3">
      <Notice kind="warn">Keys never leave your browser, but treat any secret you paste here as exposed to your clipboard, browser extensions and screen. Prefer test keys.</Notice>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Message"><Textarea aria-label="Message" value={msg} onChange={(e) => setMsg(e.target.value)} rows={6} className="w-full" placeholder="Message to sign (UTF-8)" /></Panel>
        <Panel title="Key & algorithm"><div className="grid gap-3">
          <Field label="Secret key"><Input type="password" autoComplete="off" aria-label="Secret key" value={key} onChange={(e) => setKey(e.target.value)} className="mono" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Key format"><Select value={keyFmt} onChange={(e) => setKeyFmt(e.target.value)}><option value="text">Text (UTF-8)</option><option value="hex">Hex</option><option value="b64">Base64</option></Select></Field>
            <Field label="Hash"><Select value={alg} onChange={(e) => setAlg(e.target.value as HashAlg)}><option>SHA-256</option><option>SHA-384</option><option>SHA-512</option><option value="SHA-1">SHA-1 (legacy)</option></Select></Field></div>
        </div></Panel>
      </div>
      <Panel title="Verify (optional)"><div className="grid gap-3 sm:grid-cols-[1fr_160px]"><Field label="Signature to verify"><Input aria-label="Signature to verify" value={sig} onChange={(e) => setSig(e.target.value)} className="mono" placeholder="Paste expected signature" /></Field><Field label="Signature format"><Select value={sigFmt} onChange={(e) => setSigFmt(e.target.value)}><option value="hex">Hex</option><option value="b64">Base64</option></Select></Field></div></Panel>
      <div><Button variant="default" onClick={run} data-testid="hmac-run">Generate{sig.trim() ? ' & verify' : ''}</Button></div>
      {err && <Notice kind="error">{err}</Notice>}
      {res && (<>
        {res.ok !== undefined && <Grid cols={2}><Stat label="Verification" value={res.ok ? 'Signature valid' : 'Signature INVALID'} tone={res.ok ? 'ok' : 'bad'} /></Grid>}
        <Panel title={`HMAC-${alg}`}><div className="space-y-2">{([['Hex', res.hex], ['Base64', res.b64]] as const).map(([l, v]) => <div key={l} className="flex items-center gap-2"><span className="w-14 text-xs text-muted-foreground">{l}</span><code className="mono min-w-0 flex-1 break-all text-sm" data-testid={`hmac-${l}`}>{v}</code><CopyButton text={v} size="icon" label={`Copy ${l}`} /></div>)}</div></Panel></>)}
    </div>
  )
}
