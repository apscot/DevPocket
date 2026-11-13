import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { CATEGORIES, searchTools } from '@/registry'
import { Icon } from './Icon'
import { cn } from '@/lib/cn'

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [idx, setIdx] = useState(0)
  const nav = useNavigate()
  const ref = useRef<HTMLInputElement>(null)
  const results = useMemo(() => searchTools(q, cat || undefined).slice(0, 30), [q, cat])
  useEffect(() => { if (open) { setQ(''); setCat(''); setIdx(0); setTimeout(() => ref.current?.focus(), 0) } }, [open])
  useEffect(() => setIdx(0), [q, cat])
  if (!open) return null
  const go = (route: string) => { nav(route); onClose() }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Search tools">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-3">
          <Search size={16} className="text-muted-foreground" />
          <input
            ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools by name, description or tag…"
            aria-label="Search tools" data-testid="palette-input"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
              else if (e.key === 'Enter' && results[idx]) go(results[idx].route)
              else if (e.key === 'Escape') onClose()
            }}
          />
          <kbd className="rounded border px-1.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <div className="flex gap-1.5 overflow-x-auto border-b px-3 py-2 scroll-thin">
          {[{ id: '', name: 'All' }, ...CATEGORIES].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={cn('shrink-0 cursor-pointer rounded-full border px-2.5 py-0.5 text-xs', cat === c.id ? 'border-primary bg-accent text-primary' : 'text-muted-foreground hover:bg-muted')}>{c.name.split(',')[0].split(' &')[0]}</button>
          ))}
        </div>
        <ul className="max-h-[50vh] overflow-auto p-1.5 scroll-thin" role="listbox">
          {results.map((t, i) => (
            <li key={t.id} role="option" aria-selected={i === idx}>
              <button onClick={() => go(t.route)} onMouseEnter={() => setIdx(i)} className={cn('flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-left', i === idx && 'bg-muted')}>
                <Icon name={t.icon} size={16} className="shrink-0 text-primary" />
                <span className="min-w-0"><span className="block text-sm font-medium">{t.name}</span><span className="block truncate text-xs text-muted-foreground">{t.description}</span></span>
              </button>
            </li>
          ))}
          {!results.length && <li className="p-8 text-center text-sm text-muted-foreground">No tools match “{q}”. Try another keyword or category.</li>}
        </ul>
      </div>
    </div>
  )
}
