import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { Icon } from './Icon'
import { categoryById, type ToolDefinition } from '@/registry'
import { useFavorites } from '@/hooks/useLocal'
import { cn } from '@/lib/cn'

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const { favs, toggle } = useFavorites()
  const fav = favs.includes(tool.id)
  return (
    <div className="group relative rounded-lg border bg-card p-4 transition-colors hover:border-primary/60" data-testid={`card-${tool.id}`}>
      <Link to={tool.route} className="block focus-visible:outline-2 focus-visible:outline-primary rounded-lg after:absolute after:inset-0">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary"><Icon name={tool.icon} size={18} /></span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">{tool.name}</h3>
            <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{tool.description}</p>
            <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">{categoryById(tool.category)?.name}</p>
          </div>
        </div>
      </Link>
      <button
        onClick={() => toggle(tool.id)} aria-label={fav ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`} aria-pressed={fav}
        className="absolute right-2 top-2 z-10 rounded p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
      >
        <Star size={15} className={cn(fav && 'fill-warning text-warning')} />
      </button>
    </div>
  )
}

export function ToolGrid({ tools, empty }: { tools: ToolDefinition[]; empty?: string }) {
  if (!tools.length) return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{empty ?? 'Nothing here yet.'}</p>
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{tools.map((t) => <ToolCard key={t.id} tool={t} />)}</div>
}
