import { useMemo, useState } from 'react'
import { Empty, Field, InputPane, Panel, Select, CopyButton } from '@/components/kit'
import { parseTimestamp } from '@/lib/logs'
import { allTimezones, detectEpoch, formatInTz, isoInTz, localTz, relativeTime, zonedToUtc } from '@/lib/datetime'

const SAMPLE = `1710152142123
1710152142
2024-03-11T10:15:42.123Z
2024-03-11 10:15:42,123
11/Mar/2024:10:15:42 +0000
Mar 11 10:15:42
1710152142123456`
interface Row { src: string; fmt: string; ms: number }
export default function LogTimestamp() {
  const [t, setT] = useState(''); const [tz, setTz] = useState('UTC'); const [out, setOut] = useState(localTz())
  const zones = useMemo(() => ['UTC', ...allTimezones().filter((z) => z !== 'UTC')], [])
  const rows = useMemo(() => {
    const res: Row[] = []
    for (const line of t.split(/\r?\n/)) {
      const s = line.trim(); if (!s) continue
      const tokens = [...s.matchAll(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?|\d{2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}|[A-Z][a-z]{2}\s+\d{1,2} \d{2}:\d{2}:\d{2}|\b\d{10,19}\b/g)].map((m) => m[0])
      for (const tok of tokens.length ? tokens : [s]) {
        if (/^\d+$/.test(tok)) { const e = detectEpoch(BigInt(tok)); if (e) res.push({ src: tok, fmt: `Epoch ${{ s: 'seconds', ms: 'milliseconds', us: 'microseconds', ns: 'nanoseconds' }[e.unit]}`, ms: e.ms }); continue }
        const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?$/.exec(tok)
        if (m) { res.push({ src: tok, fmt: `Local date-time (interpreted in ${tz})`, ms: zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6], m[7] ? Number(m[7].padEnd(3, '0').slice(0, 3)) : 0, tz) }); continue }
        const p = parseTimestamp(tok, 'utc'); if (p !== undefined) res.push({ src: tok, fmt: /^\d{4}/.test(tok) ? 'ISO-8601 with offset' : /\//.test(tok) ? 'Common Log Format' : 'Syslog (current year assumed, UTC)', ms: p })
        else { const d = Date.parse(tok); if (!Number.isNaN(d)) res.push({ src: tok, fmt: 'RFC 2822 / parseable date', ms: d }) }
      }
    }
    return res
  }, [t, tz])
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <InputPane title="Timestamps (one or more per line, or whole log lines)" value={t} onChange={setT} sample={SAMPLE} rows={8} />
        <Panel title="Time zones"><div className="grid gap-3"><Field label="Interpret zone-less timestamps as"><Select value={tz} onChange={(e) => setTz(e.target.value)}>{zones.map((z) => <option key={z}>{z}</option>)}</Select></Field><Field label="Display zone"><Select value={out} onChange={(e) => setOut(e.target.value)}>{[out, ...zones.filter((z) => z !== out)].map((z) => <option key={z}>{z}</option>)}</Select></Field></div></Panel>
      </div>
      {!rows.length ? <Empty>{t.trim() ? 'No recognizable timestamps found.' : 'Paste epoch seconds/milliseconds/microseconds, ISO-8601, syslog or access-log timestamps.'}</Empty> : (
        <Panel title={`Converted (${rows.length})`}><div className="scroll-thin overflow-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="p-1.5">Input</th><th>Detected</th><th>UTC (ISO)</th><th>{out}</th><th>Epoch s / ms</th><th>Relative</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t align-top"><td className="mono p-1.5">{r.src}</td><td className="text-xs text-muted-foreground">{r.fmt}</td><td className="mono">{new Date(r.ms).toISOString()}</td><td className="mono text-xs">{isoInTz(r.ms, out)}<div className="text-muted-foreground">{formatInTz(r.ms, out)}</div></td><td className="mono text-xs">{Math.floor(r.ms / 1000)}<div>{Math.round(r.ms)}</div></td><td className="text-xs">{relativeTime(r.ms)}</td><td><CopyButton text={new Date(r.ms).toISOString()} size="icon" label="Copy ISO" /></td></tr>)}</tbody></table></div></Panel>)}
    </div>
  )
}
