import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button, Empty, Field, Input, Panel, Select, SearchBox } from '@/components/kit'
import { allTimezones, formatInTz, localTz, offsetLabel, tzOffsetMinutes, zonedToUtc } from '@/lib/datetime'
import { pad } from '@/lib/util'

const DEFAULTS = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney']
function nextTransition(tz: string, from: number): { at: number; from: string; to: string } | null {
  let prev = tzOffsetMinutes(from, tz)
  for (let d = 1; d <= 400; d++) { const t = from + d * 86400000; const o = tzOffsetMinutes(t, tz); if (o !== prev) { let lo = t - 86400000, hi = t; while (hi - lo > 60000) { const mid = Math.floor((lo + hi) / 2); if (tzOffsetMinutes(mid, tz) === prev) lo = mid; else hi = mid } return { at: hi, from: offsetLabel(lo, tz), to: offsetLabel(hi, tz) } } }
  return null
}
export default function TimezoneCompare() {
  const zones = useMemo(allTimezones, [])
  const [src, setSrc] = useState(localTz()); const now = new Date()
  const [dt, setDt] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`)
  const [sel, setSel] = useState<string[]>(DEFAULTS); const [q, setQ] = useState('')
  const ms = useMemo(() => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(dt); return m ? zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], 0, 0, src) : null }, [dt, src])
  const matches = zones.filter((z) => q && z.toLowerCase().includes(q.toLowerCase()) && !sel.includes(z)).slice(0, 8)
  const srcDay = ms !== null ? formatInTz(ms, src, { dateStyle: undefined, timeStyle: undefined, year: 'numeric', month: '2-digit', day: '2-digit' }) : ''
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Source moment" actions={<Button onClick={() => { const n = new Date(); setDt(`${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`); setSrc(localTz()) }}>Now (local)</Button>}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Date & time"><Input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} aria-label="Date and time" /></Field>
          <Field label="In time zone"><Select value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Source time zone">{[...new Set([src, 'UTC', ...zones])].map((z) => <option key={z}>{z}</option>)}</Select></Field></div></Panel>
      <Panel title="Add zones"><SearchBox value={q} onChange={setQ} placeholder="Search IANA zones (e.g. Paris)" className="max-w-sm" />{matches.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{matches.map((z) => <Button key={z} onClick={() => { setSel([...sel, z]); setQ('') }}>+ {z}</Button>)}</div>}</Panel>
      {ms === null ? <Empty>Enter a valid date and time.</Empty> : (
        <Panel title="Local times"><div className="scroll-thin overflow-auto"><table className="w-full text-sm" data-testid="tz-table"><thead className="text-left text-xs text-muted-foreground"><tr><th className="p-1.5">Zone</th><th>Local time</th><th>Offset</th><th>DST</th><th>Next offset change</th><th /></tr></thead>
          <tbody>{[src, ...sel.filter((z) => z !== src)].map((z) => { const off = tzOffsetMinutes(ms, z); const jan = tzOffsetMinutes(Date.UTC(new Date(ms).getUTCFullYear(), 0, 1), z), jul = tzOffsetMinutes(Date.UTC(new Date(ms).getUTCFullYear(), 6, 1), z); const dst = jan !== jul && off === Math.max(jan, jul); const tr = nextTransition(z, ms); const day = formatInTz(ms, z, { dateStyle: undefined, timeStyle: undefined, year: 'numeric', month: '2-digit', day: '2-digit' })
            return <tr key={z} className="border-t align-top"><td className="p-1.5 font-medium">{z}{z === src && <span className="ml-1 rounded bg-accent px-1 text-[10px] text-primary">source</span>}</td><td className="mono">{formatInTz(ms, z, { dateStyle: 'medium', timeStyle: 'short' })}{day !== srcDay && <span className="ml-1 text-xs text-warning">({day > srcDay ? '+1 day' : '−1 day'})</span>}</td><td className="mono">{offsetLabel(ms, z)}</td><td>{jan === jul ? '—' : dst ? 'Daylight' : 'Standard'}</td><td className="text-xs text-muted-foreground">{tr ? `${new Date(tr.at).toISOString().slice(0, 16).replace('T', ' ')} UTC (${tr.from} → ${tr.to})` : 'none within 13 months'}</td><td>{z !== src && <Button variant="ghost" size="icon" aria-label={`Remove ${z}`} onClick={() => setSel(sel.filter((x) => x !== z))}><X size={14} /></Button>}</td></tr> })}</tbody></table></div>
          <p className="mt-2 text-[11px] text-muted-foreground">Offsets come from the browser’s IANA time-zone database, so daylight-saving rules for the chosen date are applied automatically. Non-existent local times (spring-forward gaps) are shifted forward.</p></Panel>)}
    </div>
  )
}
