import { useEffect, useRef, useState } from 'react'
import { Button, CopyButton, DownloadButton, Notice, Panel, Select, Textarea, useDebounced } from '@/components/kit'
import { downloadBlob } from '@/lib/util'

const SAMPLES: Record<string, string> = {
  Flowchart: 'flowchart TD\n  A[Client] -->|HTTP| B(API Gateway)\n  B --> C{Auth?}\n  C -->|yes| D[Service]\n  C -->|no| E[401]\n  D --> F[(Database)]',
  Sequence: 'sequenceDiagram\n  participant U as User\n  participant S as Server\n  U->>S: POST /login\n  S-->>U: 200 + JWT\n  U->>S: GET /me (Bearer)\n  S-->>U: profile',
  Class: 'classDiagram\n  class Animal {\n    +String name\n    +speak() void\n  }\n  class Dog\n  Animal <|-- Dog',
  State: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Running: start\n  Running --> Idle: stop\n  Running --> [*]: crash',
  ER: 'erDiagram\n  USER ||--o{ ORDER : places\n  ORDER ||--|{ LINE_ITEM : contains\n  USER { int id string email }',
  Gantt: 'gantt\n  title Release plan\n  dateFormat YYYY-MM-DD\n  section Dev\n  Build :a1, 2024-03-01, 10d\n  Test  :after a1, 5d',
  Pie: 'pie title Languages\n  "Java" : 45\n  "TypeScript" : 35\n  "SQL" : 20',
}
let n = 0
export default function MermaidEditor() {
  const [code, setCode] = useState(SAMPLES.Flowchart); const dc = useDebounced(code, 400)
  const [svg, setSvg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(true)
  const dark = document.documentElement.classList.contains('dark')
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      if (!dc.trim()) { setSvg(''); setErr(''); setBusy(false); return }
      try {
        setBusy(true)
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' })
        await mermaid.parse(dc)
        const { svg } = await mermaid.render(`mmd-${++n}`, dc)
        if (live) { setSvg(svg); setErr('') }
      } catch (e) { if (live) { setErr((e as Error).message.replace(/<[^>]+>/g, '')); } document.getElementById(`dmmd-${n}`)?.remove() }
      finally { if (live) setBusy(false) }
    })()
    return () => { live = false }
  }, [dc, dark])
  const png = async () => {
    const img = new Image(); const blob = new Blob([svg], { type: 'image/svg+xml' }); const url = URL.createObjectURL(blob)
    img.onload = () => { const s = 2; const c = document.createElement('canvas'); c.width = (img.width || 800) * s; c.height = (img.height || 600) * s; const x = c.getContext('2d')!; x.fillStyle = dark ? '#111' : '#fff'; x.fillRect(0, 0, c.width, c.height); x.scale(s, s); x.drawImage(img, 0, 0); c.toBlob((b) => b && downloadBlob('diagram.png', b)); URL.revokeObjectURL(url) }
    img.src = url
  }
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(300px,1fr)_1.3fr]">
      <Panel title="Mermaid source" actions={<Select aria-label="Sample" value="" onChange={(e) => e.target.value && setCode(SAMPLES[e.target.value])} className="h-8 w-36"><option value="">Samples…</option>{Object.keys(SAMPLES).map((k) => <option key={k}>{k}</option>)}</Select>}>
        <Textarea aria-label="Mermaid source" value={code} onChange={(e) => setCode(e.target.value)} rows={22} className="w-full" />
        <p className="mt-1 text-[11px] text-muted-foreground">Rendered locally with Mermaid in strict security mode (no scripts or click handlers).</p></Panel>
      <div className="flex min-w-0 flex-col gap-3">
        {err && <Notice kind="error"><span className="mono">{err}</span></Notice>}
        <Panel title="Diagram" actions={<><DownloadButton text={svg} filename="diagram.svg" mime="image/svg+xml" label="SVG" disabled={!svg} /><Button disabled={!svg} onClick={png}>PNG</Button><CopyButton text={svg} label="Copy SVG" /></>}>
          {busy && !svg && <p className="text-sm text-muted-foreground">Loading Mermaid…</p>}
          <div ref={host} className="scroll-thin max-h-[640px] overflow-auto rounded-md border bg-card p-3" data-testid="mermaid-out" dangerouslySetInnerHTML={{ __html: svg }} />
        </Panel>
      </div>
    </div>
  )
}
