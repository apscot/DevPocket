import DOMPurify from 'dompurify'

export function sanitizeSvg(src: string): { clean: string; removed: string[]; error?: string } {
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return { clean: '', removed: [], error: 'Invalid SVG/XML: ' + (doc.querySelector('parsererror')?.textContent ?? '').split('\n')[0].slice(0, 200) }
  if (doc.documentElement.nodeName.toLowerCase() !== 'svg') return { clean: '', removed: [], error: 'Root element must be <svg>.' }
  const purify = DOMPurify(window)
  const removedSet = new Set<string>()
  purify.addHook('uponSanitizeElement', (_n, d) => { if (d.allowedTags && !d.allowedTags[d.tagName]) removedSet.add(`<${d.tagName}>`) })
  purify.addHook('uponSanitizeAttribute', (_n, d) => { if (d.forceKeepAttr === undefined && !d.keepAttr) removedSet.add(d.attrName) })
  const clean = purify.sanitize(src, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['script', 'foreignObject', 'use', 'image', 'a'], FORBID_ATTR: ['href', 'xlink:href'] }) as string
  if (/<script|\son\w+\s*=/i.test(src)) removedSet.add('scripts / event handlers')
  if (/<foreignObject|<use|<image|href\s*=/i.test(src)) removedSet.add('external/embedded references')
  let out = clean
  if (out && !/xmlns=/.test(out.slice(0, 300))) out = out.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
  return { clean: out, removed: [...removedSet].filter((x) => !/^<(svg|g|path|rect|circle)/.test(x)) }
}
export function inspectSvg(svg: string) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml'); const root = doc.documentElement
  const counts = new Map<string, number>(); doc.querySelectorAll('*').forEach((e) => counts.set(e.tagName, (counts.get(e.tagName) ?? 0) + 1))
  return { width: root.getAttribute('width'), height: root.getAttribute('height'), viewBox: root.getAttribute('viewBox'), elements: doc.querySelectorAll('*').length, tags: [...counts].sort((a, b) => b[1] - a[1]) }
}
