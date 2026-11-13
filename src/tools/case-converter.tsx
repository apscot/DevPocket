import { TransformTool, CopyButton, Panel } from '@/components/kit'
import { CASES, convertCase, type CaseKind } from '@/lib/text'

export default function CaseConverter() {
  return <TransformTool sample={'user_profile_id\nXMLHttpRequest\nhello world from DevPocket\nAPI-gateway-URL'} filename="converted.txt"
    options={[{ key: 'kind', label: 'Convert to', type: 'select', default: 'camel', options: CASES }, { key: 'perLine', label: 'Convert each line separately', type: 'check', default: true }]}
    run={(i, o) => (o.perLine ? i.split(/\r?\n/).map((l) => convertCase(l, o.kind as CaseKind)).join('\n') : convertCase(i, o.kind as CaseKind))}
    extra={(i) => { const first = i.split(/\r?\n/).find((l) => l.trim()); if (!first) return null; return (
      <Panel title="All formats (first line)"><ul className="space-y-1">{CASES.map(([k, l]) => { const v = convertCase(first, k); return <li key={k} className="flex items-center gap-2 text-sm"><span className="w-32 text-xs text-muted-foreground">{l}</span><code className="mono min-w-0 flex-1 break-all">{v}</code><CopyButton text={v} size="icon" label={`Copy ${l}`} /></li> })}</ul></Panel>) }} />
}
