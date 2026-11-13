import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { Home, LayoutGrid, Star, History, Search, Menu, X, Sun, Moon, Monitor } from 'lucide-react'
import { CATEGORIES, TOOLS } from '@/registry'
import { Icon } from './Icon'
import { SearchPalette } from './SearchPalette'
import { applyTheme, useLocal, type Theme } from '@/hooks/useLocal'
import { cn } from '@/lib/cn'

const link = ({ isActive }: { isActive: boolean }) =>
  cn('flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm', isActive ? 'bg-accent font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')

export function Layout() {
  const [theme, setTheme] = useLocal<Theme>('theme', 'system')
  const [searchOpen, setSearchOpen] = useState(false)
  const [nav, setNav] = useState(false)
  const loc = useLocation()
  useEffect(() => { applyTheme(theme) }, [theme])
  useEffect(() => {
    if (theme !== 'system') return
    const m = matchMedia('(prefers-color-scheme: dark)'); const h = () => applyTheme('system')
    m.addEventListener('change', h); return () => m.removeEventListener('change', h)
  }, [theme])
  useEffect(() => setNav(false), [loc.pathname])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true) }
      else if (e.key === '/' && !typing) { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3 scroll-thin" aria-label="Primary">
      <Link to="/" className="mb-2 flex items-center gap-2 px-2 py-1.5">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
        <span className="text-base font-bold tracking-tight">DevPocket</span>
      </Link>
      <button onClick={() => setSearchOpen(true)} data-testid="open-search" className="mb-2 flex cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm text-muted-foreground hover:border-primary/50">
        <Search size={15} /> Search <kbd className="ml-auto rounded border px-1 text-[10px]">⌘K</kbd>
      </button>
      <NavLink to="/" end className={link}><Home size={16} /> Home</NavLink>
      <NavLink to="/tools" end className={link}><LayoutGrid size={16} /> All Tools <span className="ml-auto text-xs">{TOOLS.length}</span></NavLink>
      <NavLink to="/favorites" className={link}><Star size={16} /> Favorites</NavLink>
      <NavLink to="/recent" className={link}><History size={16} /> Recently Used</NavLink>
      <p className="mt-3 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Categories</p>
      {CATEGORIES.map((c) => (
        <NavLink key={c.id} to={`/category/${c.id}`} className={link}>
          <Icon name={c.icon} size={16} /> <span className="truncate">{c.name}</span>
          <span className="ml-auto text-xs">{TOOLS.filter((t) => t.category === c.id).length}</span>
        </NavLink>
      ))}
      <div className="mt-auto pt-4">
        <div role="radiogroup" aria-label="Theme" className="flex rounded-md border bg-card p-0.5">
          {([['light', Sun], ['dark', Moon], ['system', Monitor]] as const).map(([k, I]) => (
            <button key={k} role="radio" aria-checked={theme === k} aria-label={`${k} theme`} data-testid={`theme-${k}`} onClick={() => setTheme(k)}
              className={cn('flex flex-1 cursor-pointer items-center justify-center rounded py-1.5', theme === k ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground')}><I size={15} /></button>
          ))}
        </div>
        <p className="mt-3 px-1 text-[11px] leading-snug text-muted-foreground">Everything runs in your browser. No data leaves this device.</p>
      </div>
    </nav>
  )

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 border-r bg-card/50 lg:block">{sidebar}</aside>
      {nav && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setNav(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 w-72 border-r bg-background" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-2 border-b px-3 lg:hidden">
          <button aria-label={nav ? 'Close menu' : 'Open menu'} onClick={() => setNav((v) => !v)} className="cursor-pointer rounded p-1.5 hover:bg-muted">{nav ? <X size={18} /> : <Menu size={18} />}</button>
          <span className="font-bold">DevPocket</span>
          <button aria-label="Search" onClick={() => setSearchOpen(true)} className="ml-auto cursor-pointer rounded p-1.5 hover:bg-muted"><Search size={18} /></button>
        </header>
        <main className="min-h-0 flex-1 overflow-auto scroll-thin" id="main"><Outlet /></main>
      </div>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
