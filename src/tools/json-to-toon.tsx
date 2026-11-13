import { useEffect, useState } from 'react'
import { TransformTool, Grid, Stat } from '@/components/kit'
import { parseJson } from '@/lib/json'
import { toToon } from '@/lib/toon'
import { SAMPLE_JSON } from '@/lib/samples'

const SAMPLE = '{"users":[{"id":1,"name":"Ada","role":"admin"},{"id":2,"name":"Grace","role":"user"}],"tags":["a","b"],"meta":{"count":2,"active":true}}'
export default function JsonToToon() {
  return <TransformTool sample={SAMPLE} filename="data.toon" mime="text/plain"
    notice={{ kind: 'info', text: 'TOON (Token-Oriented Object Notation) is a compact, indentation-based encoding of JSON designed to use fewer LLM tokens: uniform object arrays become tables.' }}
    options={[
      { key: 'indent', label: 'Indent', type: 'select', default: '2', options: [['2', '2 spaces'], ['4', '4 spaces']] },
      { key: 'delimiter', label: 'Delimiter', type: 'select', default: ',', options: [[',', 'Comma'], ['\t', 'Tab'], ['|', 'Pipe']] },
      { key: 'lengthMarker', label: 'Length marker (#)', type: 'check', default: false },
    ]}
    run={(i, o) => toToon(parseJson(i), { indent: Number(o.indent), delimiter: o.delimiter, lengthMarker: o.lengthMarker })}
    extra={(i, out) => <Savings json={i} toon={out} />} />
}
void SAMPLE_JSON
const pct = (a: number, b: number) => { const d = Math.round(((a - b) / a) * 100); return d > 0 ? `${d}% smaller` : d < 0 ? `${-d}% larger` : 'no change' }
function Savings({ json, toon }: { json: string; toon: string }) {
  const [tok, setTok] = useState<{ orig: number; mini: number; toon: number } | null>(null)
  const mini = (() => { try { return JSON.stringify(JSON.parse(json)) } catch { return null } })()
  useEffect(() => {
    let live = true
    if (!toon || mini === null) { setTok(null); return }
    import('gpt-tokenizer/encoding/o200k_base').then((t) => { if (live) setTok({ orig: t.encode(json).length, mini: t.encode(mini).length, toon: t.encode(toon).length }) })
    return () => { live = false }
  }, [json, toon, mini])
  if (!toon || mini === null) return null
  const row = (label: string, a: number, b: number) => <Stat label={label} value={`${a} → ${b} (${pct(a, b)})`} tone={b <= a ? 'ok' : undefined} />
  return (
    <div className="flex flex-col gap-2">
      <Grid cols={2}>
        {row('Chars: your input → TOON', json.length, toon.length)}
        {row('Chars: minified JSON → TOON', mini.length, toon.length)}
        {tok ? row('Tokens (o200k): your input → TOON', tok.orig, tok.toon) : <Stat label="Tokens (o200k): your input → TOON" value="…" />}
        {tok ? row('Tokens (o200k): minified JSON → TOON', tok.mini, tok.toon) : <Stat label="Tokens (o200k): minified JSON → TOON" value="…" />}
      </Grid>
      <p className="text-xs text-muted-foreground">TOON is smallest for uniform arrays of objects with primitive values (written as tables). Rows that contain nested objects or arrays fall back to a longer list form, so against already-minified JSON the result can be about the same or larger.</p>
    </div>
  )
}
