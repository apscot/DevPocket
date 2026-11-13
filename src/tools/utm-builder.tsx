import { useMemo, useState } from 'react'
import { Check_, Field, Input, Notice, OutputPane, Panel } from '@/components/kit'

const KEYS: [string, string, string][] = [['utm_source', 'Source *', 'newsletter'], ['utm_medium', 'Medium *', 'email'], ['utm_campaign', 'Campaign *', 'spring_sale'], ['utm_term', 'Term', 'running shoes'], ['utm_content', 'Content', 'header_cta'], ['utm_id', 'Campaign ID', '']]
export default function UtmBuilder() {
  const [url, setUrl] = useState('https://example.com/pricing'); const [v, setV] = useState<Record<string, string>>({ utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'spring_sale' })
  const [lower, setLower] = useState(true); const [under, setUnder] = useState(true)
  const r = useMemo(() => {
    const warnings: string[] = []
    try {
      const raw = url.trim(); if (!raw) return { out: '', warnings, err: 'Enter a destination URL.' }
      const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw)
      if (!/^https?:$/.test(u.protocol)) return { out: '', warnings, err: 'Only http(s) URLs are supported.' }
      if (!/\./.test(u.hostname) && u.hostname !== 'localhost') warnings.push('Hostname does not look like a domain.')
      for (const [k] of KEYS) {
        let val = (v[k] ?? '').trim(); if (!val) { u.searchParams.delete(k); continue }
        if (lower) val = val.toLowerCase(); if (under) val = val.replace(/\s+/g, '_')
        u.searchParams.set(k, val)
      }
      const missing = ['utm_source', 'utm_medium', 'utm_campaign'].filter((k) => !(v[k] ?? '').trim())
      if (missing.length) warnings.push(`Missing recommended parameters: ${missing.join(', ')}`)
      if (/[A-Z]/.test(Object.values(v).join('')) && !lower) warnings.push('Mixed-case values are tracked separately by analytics tools (Spring ≠ spring).')
      return { out: u.href.replace(/\+/g, '%20'), warnings, err: '' }
    } catch { return { out: '', warnings, err: 'That is not a valid URL.' } }
  }, [url, v, lower, under])
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Campaign"><div className="grid gap-3"><Field label="Website URL *"><Input value={url} onChange={(e) => setUrl(e.target.value)} className="mono" aria-label="Website URL" /></Field>
        {KEYS.map(([k, l, ph]) => <Field key={k} label={l}><Input value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder={ph} aria-label={l} /></Field>)}
        <div className="flex flex-wrap gap-4"><Check_ label="Lowercase values" checked={lower} onChange={setLower} /><Check_ label="Spaces → underscores" checked={under} onChange={setUnder} /></div></div></Panel>
      <div className="flex min-w-0 flex-col gap-3">{r.err && <Notice kind="error">{r.err}</Notice>}{r.warnings.map((w, i) => <Notice key={i} kind="warn">{w}</Notice>)}<OutputPane title="Campaign URL" value={r.out} filename="utm-url.txt" rows={6} /><p className="text-xs text-muted-foreground">Parameters are percent-encoded automatically; existing query parameters and fragments in your URL are preserved.</p></div>
    </div>
  )
}
