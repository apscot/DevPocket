import { useMemo, useState } from 'react'
import { Check_, Empty, Field, Grid, InputPane, Notice, OutputPane, Panel, Select, Stat, Textarea } from '@/components/kit'
import { BUILTIN_RULES, detectSecrets, redact, type RedactStyle } from '@/lib/security'

const SAMPLE = `spring.datasource.url=jdbc:postgresql://db:5432/app
spring.datasource.password=Sup3rS3cret!
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
Authorization: Bearer abcdef1234567890abcdef1234567890
{"apiKey": "sk_live_51H8abcdefghijklmnop", "user": "ada@example.com"}
https://deploy:hunter2@git.example.com/repo.git`
export default function SecretDetector() {
  const [t, setT] = useState(''); const [style, setStyle] = useState<RedactStyle>('label'); const [custom, setCustom] = useState('')
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(BUILTIN_RULES.map((r) => [r.id, r.enabled !== false])))
  const res = useMemo(() => {
    if (!t) return null
    try { const f = detectSecrets(t, BUILTIN_RULES.filter((r) => enabled[r.id]), custom.split('\n').map((x) => x.trim())); return { f, out: redact(t, f, style), err: '' } } catch (e) { return { f: [], out: '', err: (e as Error).message } }
  }, [t, enabled, style, custom])
  const byType = useMemo(() => { const m = new Map<string, number>(); res?.f.forEach((f) => m.set(f.label, (m.get(f.label) ?? 0) + 1)); return [...m] }, [res])
  return (
    <div className="flex flex-col gap-3">
      <Notice kind="warn">Detection is heuristic — always review the output before sharing. Nothing is uploaded; text stays in this tab.</Notice>
      <div className="grid gap-3 lg:grid-cols-2">
        <InputPane value={t} onChange={setT} sample={SAMPLE} placeholder="Paste logs, configs or code…" />
        <div className="flex min-w-0 flex-col gap-3">
          <Panel title="Rules"><div className="flex flex-wrap gap-x-4 gap-y-1.5">{BUILTIN_RULES.map((r) => <Check_ key={r.id} label={r.label} checked={enabled[r.id]} onChange={(v) => setEnabled({ ...enabled, [r.id]: v })} />)}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Replace with"><Select value={style} onChange={(e) => setStyle(e.target.value as RedactStyle)}><option value="label">[REDACTED:type]</option><option value="fixed">[REDACTED]</option><option value="stars">Asterisks</option><option value="partial">Partial (ab****yz)</option></Select></Field>
              <Field label="Custom regex rules (one per line)"><Textarea value={custom} onChange={(e) => setCustom(e.target.value)} rows={2} className="min-h-[60px] w-full" placeholder="EMP-\d{6}" aria-label="Custom regex rules" /></Field></div></Panel>
        </div>
      </div>
      {res?.err && <Notice kind="error">{res.err}</Notice>}
      {!res ? <Empty>Paste text to find passwords, API keys, tokens and credentials.</Empty> : !res.err && (
        <>
          <Grid cols={3}><Stat label="Redactions" value={res.f.length} tone={res.f.length ? 'warn' : 'ok'} /><Stat label="Types" value={byType.length} /><Stat label="Lines affected" value={new Set(res.f.map((f) => f.line)).size} /></Grid>
          {byType.length > 0 && <div className="flex flex-wrap gap-1.5">{byType.map(([l, n]) => <span key={l} className="rounded-full border px-2.5 py-0.5 text-xs">{l} <b>×{n}</b></span>)}</div>}
          <OutputPane title="Sanitized output" value={res.out} filename="sanitized.txt" rows={12} />
        </>
      )}
    </div>
  )
}
