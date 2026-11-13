import { useMemo, useState } from 'react'
import { Empty, Field, Grid, Input, Notice, Panel, Select, Stat, CopyButton, Button } from '@/components/kit'
import { SNOWFLAKE_PRESETS, composeSnowflake, decodeSnowflake } from '@/lib/datetime'

export default function SnowflakeDecoder() {
  const [id, setId] = useState(''); const [preset, setPreset] = useState('twitter')
  const p = SNOWFLAKE_PRESETS[preset]
  const [epoch, setEpoch] = useState(String(p.epoch)); const [dc, setDc] = useState(p.dc); const [wk, setWk] = useState(p.worker); const [sq, setSq] = useState(p.seq)
  const pick = (k: string) => { const x = SNOWFLAKE_PRESETS[k]; setPreset(k); if (k !== 'custom') { setEpoch(String(x.epoch)); setDc(x.dc); setWk(x.worker); setSq(x.seq) } }
  const r = useMemo(() => {
    if (!id.trim()) return null
    try {
      if (!/^\d+$/.test(id.trim())) throw new Error('A Snowflake ID is a positive decimal integer.')
      if (!/^\d+$/.test(epoch)) throw new Error('Epoch must be milliseconds since 1970 (integer).')
      const v = BigInt(id.trim()); if (v >= 1n << 64n) throw new Error('ID exceeds 64 bits.')
      const d = decodeSnowflake(v, BigInt(epoch), dc, wk, sq)
      if (!Number.isFinite(new Date(d.timestampMs).getTime())) throw new Error('Decoded timestamp is out of range — the layout/epoch probably does not match this ID.')
      return { d, bin: v.toString(2).padStart(64, '0'), err: '' }
    } catch (e) { return { d: null, bin: '', err: (e as Error).message } }
  }, [id, epoch, dc, wk, sq])
  const d = r?.d; const ms = d?.timestampMs
  const [gen, setGen] = useState('')
  return (
    <div className="flex flex-col gap-3">
      <Notice kind="info">Snowflake IDs have no universal layout. Choose a preset or enter the epoch and bit widths used by your system. If the layout is unknown, the decoded fields may be meaningless.</Notice>
      <Panel title="ID & layout"><div className="grid gap-3 sm:grid-cols-2"><Field label="Snowflake ID"><Input value={id} onChange={(e) => setId(e.target.value)} placeholder="1541815603606036480" className="mono" aria-label="Snowflake ID" /></Field>
        <Field label="Preset"><Select value={preset} onChange={(e) => pick(e.target.value)}>{Object.entries(SNOWFLAKE_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-4"><Field label="Epoch (ms)"><Input value={epoch} onChange={(e) => { setEpoch(e.target.value); setPreset('custom') }} className="mono" aria-label="Epoch" /></Field><Field label="Datacenter bits"><Input type="number" min={0} max={20} value={dc} onChange={(e) => { setDc(Number(e.target.value)); setPreset('custom') }} /></Field><Field label="Worker bits"><Input type="number" min={0} max={20} value={wk} onChange={(e) => { setWk(Number(e.target.value)); setPreset('custom') }} /></Field><Field label="Sequence bits"><Input type="number" min={0} max={20} value={sq} onChange={(e) => { setSq(Number(e.target.value)); setPreset('custom') }} /></Field></div>
        <p className="mt-2 text-xs text-muted-foreground">{p.note}. Timestamp bits = 64 − 1 (sign) − {dc + wk + sq} = {63 - dc - wk - sq}.</p></Panel>
      {r?.err && <Notice kind="error">{r.err}</Notice>}
      {!r && <Empty>Paste a Snowflake ID to decode its timestamp, worker and sequence.</Empty>}
      {d && ms !== undefined && (<>
        <Grid cols={4}><Stat label="Created (UTC)" value={<span className="text-sm" data-testid="sf-time">{new Date(ms).toISOString()}</span>} /><Stat label="Datacenter / internal worker" value={String(d.datacenter)} /><Stat label="Worker / process" value={String(d.worker)} /><Stat label="Sequence" value={String(d.sequence)} /></Grid>
        <Panel title="Details"><table className="w-full text-sm"><tbody>{[['Local time', new Date(ms).toLocaleString()], ['Epoch ms', String(ms)], ['Timestamp part (since epoch)', String(d.tsPart)], ['Binary (64-bit)', r!.bin]].map(([l, v]) => <tr key={l} className="border-t"><td className="w-56 py-1.5 text-muted-foreground">{l}</td><td className="mono break-all">{v}</td><td className="w-10"><CopyButton text={v} size="icon" label={`Copy ${l}`} /></td></tr>)}</tbody></table></Panel></>)}
      <Panel title="Generate an ID from parts (same layout)" actions={<Button onClick={() => { try { setGen(composeSnowflake(Date.now(), BigInt(epoch), dc, wk, sq, 1n % (1n << BigInt(dc || 1)), 1n, 0n).toString()) } catch { setGen('') } }}>Generate example for now</Button>}>{gen ? <code className="mono break-all text-sm">{gen}</code> : <p className="text-sm text-muted-foreground">Creates an illustrative ID for the current time using the layout above (not a unique ID generator).</p>}</Panel>
    </div>
  )
}
