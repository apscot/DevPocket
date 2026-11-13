import { useState } from 'react'
import { Notice, TransformTool, Tabs } from '@/components/kit'
import { formatEnv, parseEnv } from '@/lib/env'

const SAMPLE = `# database
export DB_HOST=localhost
DB_PORT=5432
DB_PASSWORD="p@ss word"   # keep secret
EMPTY=
BAD LINE
DB_PORT=6543`
export default function EnvToolkit() {
  const [tab, setTab] = useState<'format' | 'json' | 'validate'>('validate')
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={tab} onChange={setTab} items={[['validate', 'Parse & validate'], ['format', 'Format'], ['json', 'Convert to JSON']]} />
      <Notice kind="warn">.env files often contain secrets. Nothing is uploaded or stored — processing happens in this tab only.</Notice>
      {tab === 'validate' && <TransformTool key="v" sample={SAMPLE} filename="env-report.json" mime="application/json" notice={undefined}
        run={(i) => { const r = parseEnv(i); return JSON.stringify({ variables: r.entries.length, errors: r.errors, warnings: r.warnings, entries: r.entries.map((e) => ({ key: e.key, value: e.value, line: e.line, exported: e.exported })) }, null, 2) }}
        extra={(i) => { if (!i.trim()) return null; const r = parseEnv(i); return <>{r.errors.map((e, k) => <Notice key={'e' + k} kind="error">Line {e.line}: {e.message}</Notice>)}{r.warnings.map((e, k) => <Notice key={'w' + k} kind="warn">Line {e.line}: {e.message}</Notice>)}{!r.errors.length && !r.warnings.length && <Notice kind="success">Valid .env file — {r.entries.length} variables.</Notice>}</> }} />}
      {tab === 'format' && <TransformTool key="f" sample={SAMPLE.replace('BAD LINE\n', '')} filename=".env"
        options={[{ key: 'sort', label: 'Sort keys', type: 'check', default: true }, { key: 'align', label: 'Align =', type: 'check', default: false }, { key: 'quote', label: 'Quoting', type: 'select', default: 'minimal', options: [['minimal', 'Only when needed'], ['always', 'Always double quotes'], ['preserve', 'Preserve']] }, { key: 'dropComments', label: 'Drop inline comments', type: 'check', default: false }]}
        run={(i, o) => formatEnv(i, o as never)} />}
      {tab === 'json' && <TransformTool key="j" sample={SAMPLE.replace('BAD LINE\n', '')} filename="env.json" mime="application/json"
        run={(i) => { const r = parseEnv(i); if (r.errors.length) throw new Error(r.errors.map((e) => `Line ${e.line}: ${e.message}`).join('\n')); return JSON.stringify(Object.fromEntries(r.entries.map((e) => [e.key, e.value])), null, 2) }} />}
    </div>
  )
}
