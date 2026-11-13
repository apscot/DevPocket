import { Suspense, lazy, useEffect, useMemo, useState, Component, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Search, Star, ArrowLeft, ShieldCheck } from 'lucide-react'
import { CATEGORIES, TOOLS, categoryById, searchTools, toolById, toolsIn } from '@/registry'
import { ToolGrid } from '@/components/ToolCard'
import { Icon } from '@/components/Icon'
import { pushRecent, useFavorites, useLocal } from '@/hooks/useLocal'
import { Input } from '@/components/ui/inputs'
import { cn } from '@/lib/cn'

const Page = ({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) => (
  <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
    {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    <div className="mt-6">{children}</div>
  </div>
)

export function HomePage() {
  const [q, setQ] = useState('')
  const [recent] = useLocal<string[]>('recent', [])
  const { favs } = useFavorites()
  const results = useMemo(() => (q.trim() ? searchTools(q) : null), [q])
  const pick = (ids: string[]) => ids.map(toolById).filter(Boolean) as typeof TOOLS
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <section className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground"><ShieldCheck size={13} className="text-primary" /> 100% local · no accounts · no tracking</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">DevPocket</h1>
        <p className="mt-2 text-base text-muted-foreground">{TOOLS.length} developer utilities for JSON, Spring Boot, DevOps, text, time and more. Everything runs in your browser.</p>
        <div className="relative mt-5">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools…" aria-label="Search tools" data-testid="home-search" className="h-11 pl-9 text-base" />
        </div>
      </section>
      {results ? (
        <section className="mt-8"><h2 className="mb-3 text-sm font-semibold text-muted-foreground">{results.length} result{results.length === 1 ? '' : 's'}</h2><ToolGrid tools={results} empty={`No tools match “${q}”.`} /></section>
      ) : (
        <>
          {!!recent.length && <section className="mt-10"><h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recently used</h2><ToolGrid tools={pick(recent).slice(0, 6)} /></section>}
          {!!favs.length && <section className="mt-10"><h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Favorites</h2><ToolGrid tools={pick(favs)} /></section>}
          <section className="mt-10"><h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Featured</h2><ToolGrid tools={TOOLS.filter((t) => t.featured)} /></section>
          <section className="mt-10"><h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Categories</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {CATEGORIES.map((c) => (
                <Link key={c.id} to={`/category/${c.id}`} className="rounded-lg border bg-card p-4 hover:border-primary/60" data-testid={`cat-${c.id}`}>
                  <Icon name={c.icon} size={20} className="text-primary" />
                  <h3 className="mt-2 text-sm font-semibold">{c.name}</h3>
                  <p className="mt-1 text-[13px] text-muted-foreground">{c.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{toolsIn(c.id).length} tools</p>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export function AllToolsPage() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const list = searchTools(q, cat || undefined)
  return (
    <Page title="All Tools" sub={`${TOOLS.length} tools across ${CATEGORIES.length} categories`}>
      <div className="mb-5 flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tools…" aria-label="Filter tools" className="max-w-xs" />
        <div className="flex flex-wrap gap-1.5">
          {[{ id: '', name: 'All' }, ...CATEGORIES].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={cn('cursor-pointer rounded-full border px-3 py-1 text-xs', cat === c.id ? 'border-primary bg-accent text-primary' : 'text-muted-foreground hover:bg-muted')}>{c.name}</button>
          ))}
        </div>
      </div>
      <ToolGrid tools={list} empty={`No tools match “${q}”.`} />
    </Page>
  )
}

export function CategoryPage() {
  const { id = '' } = useParams()
  const c = categoryById(id)
  if (!c) return <NotFound />
  return <Page title={c.name} sub={`${c.description} · ${toolsIn(id).length} tools`}><ToolGrid tools={toolsIn(id)} /></Page>
}

export function FavoritesPage() {
  const { favs } = useFavorites()
  return <Page title="Favorites" sub="Star a tool to pin it here."><ToolGrid tools={favs.map(toolById).filter(Boolean) as typeof TOOLS} empty="No favorites yet. Click the star on any tool card." /></Page>
}
export function RecentPage() {
  const [recent, setRecent] = useLocal<string[]>('recent', [])
  return (
    <Page title="Recently Used" sub="Stored only in this browser. Tool inputs are never saved.">
      {!!recent.length && <button className="mb-4 cursor-pointer text-sm text-primary underline" onClick={() => setRecent([])}>Clear history</button>}
      <ToolGrid tools={recent.map(toolById).filter(Boolean) as typeof TOOLS} empty="You haven't opened any tools yet." />
    </Page>
  )
}

export function NotFound() {
  return <Page title="Not found"><p className="text-sm text-muted-foreground">That page doesn't exist. <Link to="/" className="text-primary underline">Back to home</Link></p></Page>
}

const modules = import.meta.glob('../tools/*.tsx') as Record<string, () => Promise<{ default: React.ComponentType }>>
const lazyCache: Record<string, React.LazyExoticComponent<React.ComponentType>> = {}
const getTool = (id: string) => {
  const key = `../tools/${id}.tsx`
  if (!modules[key]) return null
  return (lazyCache[id] ??= lazy(modules[key]))
}

class Boundary extends Component<{ children: ReactNode; id: string }, { err?: Error }> {
  state: { err?: Error } = {}
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidUpdate(p: { id: string }) { if (p.id !== this.props.id && this.state.err) this.setState({ err: undefined }) }
  render() {
    if (this.state.err) return <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">This tool crashed: {this.state.err.message}</div>
    return this.props.children
  }
}

export function ToolPage() {
  const { id = '' } = useParams()
  const tool = toolById(id)
  const { favs, toggle } = useFavorites()
  useEffect(() => { if (tool) { pushRecent(tool.id); document.title = `${tool.name} — DevPocket` } return () => { document.title = 'DevPocket — Developer utilities, 100% local' } }, [tool])
  const Tool = tool ? getTool(tool.id) : null
  if (!tool || !Tool) return <NotFound />
  const cat = categoryById(tool.category)
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
      <Link to={`/category/${tool.category}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={13} /> {cat?.name}</Link>
      <div className="mt-2 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Icon name={tool.icon} size={20} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight" data-testid="tool-title">{tool.name}</h1>
          <p className="text-sm text-muted-foreground">{tool.description}</p>
        </div>
        <button onClick={() => toggle(tool.id)} aria-pressed={favs.includes(tool.id)} aria-label="Toggle favorite" data-testid="fav-toggle" className="cursor-pointer rounded-md border bg-card p-2 hover:bg-muted">
          <Star size={16} className={cn(favs.includes(tool.id) && 'fill-warning text-warning')} />
        </button>
      </div>
      <div className="mt-5">
        <Boundary id={tool.id}><Suspense fallback={<p className="py-10 text-center text-sm text-muted-foreground">Loading tool…</p>}><Tool /></Suspense></Boundary>
      </div>
    </div>
  )
}
