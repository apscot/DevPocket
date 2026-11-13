import { useEffect, useMemo, useState } from 'react'
import { Empty, Field, Grid, InputPane, Notice, Panel, Select, Stat } from '@/components/kit'
import { cn } from '@/lib/cn'

interface Model { label: string; enc: 'o200k_base' | 'cl100k_base' | 'estimate'; ratio?: number; note: string }
const MODELS: Record<string, Model> = {
  'gpt-4o': { label: 'GPT-4o / GPT-4.1 / o-series (o200k_base)', enc: 'o200k_base', note: 'Exact for OpenAI models using o200k_base.' },
  'gpt-4': { label: 'GPT-4 / GPT-3.5 Turbo (cl100k_base)', enc: 'cl100k_base', note: 'Exact for OpenAI models using cl100k_base.' },
  claude: { label: 'Anthropic Claude (estimate)', enc: 'estimate', ratio: 3.5, note: 'Claude’s tokenizer is not bundled; ~3.5 characters per token is a rough English estimate. Use the API token-counting endpoint for exact billing numbers.' },
  gemini: { label: 'Google Gemini (estimate)', enc: 'estimate', ratio: 4, note: 'Estimate at ~4 characters per token.' },
  llama: { label: 'Llama / Mistral (estimate)', enc: 'estimate', ratio: 3.8, note: 'Estimate based on typical SentencePiece/BPE vocabularies.' },
}
type Enc = { encode: (s: string) => number[]; decode: (t: number[]) => string }
const palette = ['bg-primary/20', 'bg-warning/25', 'bg-success/20', 'bg-destructive/15']
export default function LlmTokenCounter() {
  const [t, setT] = useState(''); const [m, setM] = useState('gpt-4o'); const [enc, setEnc] = useState<Enc | null>(null); const [err, setErr] = useState('')
  const model = MODELS[m]
  useEffect(() => {
    let live = true; setEnc(null); setErr('')
    if (model.enc === 'estimate') return
    ;(model.enc === 'o200k_base' ? import('gpt-tokenizer/encoding/o200k_base') : import('gpt-tokenizer/encoding/cl100k_base')).then((x) => { if (live) setEnc(x as unknown as Enc) }).catch((e) => live && setErr((e as Error).message))
    return () => { live = false }
  }, [model.enc])
  const r = useMemo(() => {
    if (!t) return null
    if (model.enc === 'estimate') return { count: Math.ceil(t.length / (model.ratio ?? 4)), exact: false, pieces: null as string[] | null }
    if (!enc) return null
    try { const ids = enc.encode(t); return { count: ids.length, exact: true, pieces: ids.length <= 4000 ? ids.map((id) => enc.decode([id])) : null } } catch (e) { setErr((e as Error).message); return null }
  }, [t, enc, model])
  const words = (t.match(/\S+/g) ?? []).length
  return (
    <div className="flex flex-col gap-3">
      <Notice kind={model.enc === 'estimate' ? 'warn' : 'info'}>{model.enc === 'estimate' ? <><b>Estimate only.</b> </> : <><b>Exact count</b> using a tokenizer bundled with this app. </>}{model.note} Text never leaves your browser.</Notice>
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <InputPane value={t} onChange={setT} sample="DevPocket runs entirely in your browser. Tokenizers are bundled — no text is sent anywhere. 你好 👋" rows={12} />
        <div className="flex flex-col gap-3"><Panel title="Model / tokenizer"><Field label="Preset"><Select value={m} onChange={(e) => setM(e.target.value)} aria-label="Model">{Object.entries(MODELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field></Panel>
          {err && <Notice kind="error">{err}</Notice>}
          <Grid cols={1}><Stat label={r?.exact === false ? 'Tokens (estimated)' : 'Tokens'} value={<span data-testid="token-count">{r ? (r.exact ? '' : '≈ ') + r.count.toLocaleString() : model.enc !== 'estimate' && !enc ? 'Loading tokenizer…' : '—'}</span>} tone={r?.exact === false ? 'warn' : 'ok'} /><Stat label="Characters" value={[...t].length.toLocaleString()} /><Stat label="Words" value={words.toLocaleString()} /></Grid></div>
      </div>
      {!t ? <Empty>Paste text to count tokens.</Empty> : r?.pieces && <Panel title="Token boundaries"><div className="mono max-h-64 overflow-auto whitespace-pre-wrap break-all text-[13px] leading-7" data-testid="token-view">{r.pieces.map((p, i) => <span key={i} className={cn('rounded-sm px-px', palette[i % palette.length])}>{p.replace(/\n/g, '↵\n')}</span>)}</div></Panel>}
    </div>
  )
}
