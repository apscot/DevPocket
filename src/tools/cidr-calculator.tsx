import { useMemo, useState } from 'react'
import { Empty, Field, Grid, Input, Notice, Panel, Stat, CopyButton, Select } from '@/components/kit'
import { calcCidr, splitSubnet } from '@/lib/dockergen'

export default function CidrCalculator() {
  const [v, setV] = useState('192.168.10.37/24'); const [split, setSplit] = useState('')
  const r = useMemo(() => { if (!v.trim()) return null; try { return { info: calcCidr(v), err: '' } } catch (e) { return { info: null, err: (e as Error).message } } }, [v])
  const subs = useMemo(() => { if (!r?.info || !split) return []; try { return splitSubnet(r.info.cidr, Number(split), 64) } catch { return [] } }, [r, split])
  const i = r?.info
  const rows: [string, string][] = i ? [['CIDR', i.cidr], ['Subnet mask', i.mask], ['Wildcard mask', i.wildcard], ['Network address', i.network], ['Broadcast address', i.broadcast], ['First usable', i.first], ['Last usable', i.last], ['Mask (binary)', i.binaryMask], ['IP (binary)', i.ipBinary]] : []
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Input"><Field label="IPv4 address with CIDR prefix or mask" hint="Examples: 10.0.0.0/8 · 172.16.5.4/255.255.0.0 · 192.168.1.1"><Input value={v} onChange={(e) => setV(e.target.value)} aria-label="CIDR" className="mono max-w-md" /></Field></Panel>
      {r?.err && <Notice kind="error">{r.err}</Notice>}
      {!r && <Empty>Enter an IPv4 CIDR block such as 192.168.1.0/24.</Empty>}
      {i && (<>
        <Grid cols={4}><Stat label="Usable hosts" value={i.hosts.toLocaleString()} /><Stat label="Total addresses" value={i.total.toLocaleString()} /><Stat label="Class" value={i.ipClass} /><Stat label="Type" value={i.isPrivate ? 'Private (RFC 1918)' : 'Public / other'} /></Grid>
        <Panel title="Details"><table className="w-full text-sm"><tbody>{rows.map(([l, val]) => <tr key={l} className="border-t"><td className="w-44 py-1.5 text-muted-foreground">{l}</td><td className="mono break-all" data-testid={`cidr-${l}`}>{val}</td><td className="w-10 text-right"><CopyButton text={val} size="icon" label={`Copy ${l}`} /></td></tr>)}</tbody></table>{i.prefix >= 31 && <p className="mt-2 text-xs text-muted-foreground">/31 (point-to-point, RFC 3021) and /32 (single host) have no network/broadcast reservation.</p>}</Panel>
        <Panel title="Split into smaller subnets"><Field label="New prefix length"><Select value={split} onChange={(e) => setSplit(e.target.value)} className="w-40"><option value="">—</option>{Array.from({ length: 32 - i.prefix }, (_, k) => i.prefix + k + 1).slice(0, 12).map((p) => <option key={p} value={p}>/{p}</option>)}</Select></Field>
          {subs.length > 0 && <ul className="mono mt-2 grid max-h-64 gap-1 overflow-auto text-sm sm:grid-cols-2 lg:grid-cols-4">{subs.map((s) => <li key={s} className="rounded border px-2 py-1">{s}</li>)}</ul>}</Panel>
      </>)}
    </div>
  )
}
