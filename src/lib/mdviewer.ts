import { Marked } from 'marked'
import DOMPurify from 'dompurify'

// ---------- fenced-block scanning ----------
const OPEN = /^( {0,3})(`{3,}|~{3,})\s*([^\s`]*)[^`]*$/

/** Walks the markdown and lets `fn` rewrite fenced blocks. Fences nested inside other fences are left alone. */
export function mapFences(md: string, fn: (info: string, body: string) => string | null): string {
  const lines = md.split('\n'); const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = OPEN.exec(lines[i])
    if (!m) { out.push(lines[i]); continue }
    const fence = m[2]; let j = i + 1
    while (j < lines.length) { const t = lines[j].trim(); if (t.startsWith(fence[0].repeat(fence.length)) && /^(`+|~+)$/.test(t)) break; j++ }
    const body = lines.slice(i + 1, j).join('\n')
    const rep = j < lines.length ? fn(m[3].toLowerCase(), body) : null
    if (rep === null) { out.push(...lines.slice(i, Math.min(j + 1, lines.length))) } else out.push(rep)
    i = j
  }
  return out.join('\n')
}

/** Azure DevOps `::: mermaid` blocks -> standard ```mermaid fences (so one parser handles both). */
export function azureToFences(md: string): string {
  const lines = md.split('\n'); const out: string[] = []; let fence = ''
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (fence) { out.push(l); if (l.trim().startsWith(fence) && /^(`+|~+)$/.test(l.trim())) fence = ''; continue }
    const f = OPEN.exec(l); if (f) { fence = f[2]; out.push(l); continue }
    if (/^:::\s*mermaid\s*$/i.test(l.trim())) {
      let j = i + 1; while (j < lines.length && lines[j].trim() !== ':::') j++
      out.push('```mermaid', ...lines.slice(i + 1, j), '```'); i = j; continue
    }
    out.push(l)
  }
  return out.join('\n')
}

/** Standard ```mermaid fences -> Azure DevOps wiki `::: mermaid` blocks. */
export function toAzureWiki(md: string, opts: { toc?: boolean } = {}): string {
  let out = mapFences(md.replace(/\r\n?/g, '\n'), (info, body) => info === 'mermaid' ? `::: mermaid\n${body.replace(/\s+$/, '')}\n:::` : null)
  out = out.replace(/\n*(::: mermaid)/g, '\n\n$1').replace(/(\n:::)(?=\n)\n*(?=[^\n])/g, '$1\n\n').replace(/^\n+/, '')
  if (opts.toc && !/^\s*(\[\[_TOC_\]\]|\[TOC\])\s*$/m.test(out)) out = `[[_TOC_]]\n\n${out}`
  return out.replace(/\s*$/, '\n')
}

export const hasToc = (md: string) => /^\s*(\[\[_TOC_\]\]|\[TOC\])\s*$/m.test(md)
export const withToc = (md: string) => (hasToc(md) ? md : `[[_TOC_]]\n\n${md}`)

// ---------- rendering ----------
export interface Heading { depth: number; text: string; id: string }
export interface Rendered { html: string; headings: Heading[]; diagrams: string[] }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export function slugify(s: string) {
  return s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section'
}
const TOC_MARK = 'DEVPOCKETTOCMARKER'
const TOC_P = new RegExp(`<p>\\s*${TOC_MARK}\\s*</p>`)
/** Swaps TOC lines (outside code fences) for a marker so markdown can't turn `_TOC_` into emphasis. */
function markToc(md: string): string {
  let fence = ''
  return md.split('\n').map((l) => {
    const t = l.trim()
    if (fence) { if (t.startsWith(fence[0].repeat(fence.length)) && /^(`+|~+)$/.test(t)) fence = ''; return l }
    const f = OPEN.exec(l); if (f) { fence = f[2]; return l }
    return t === '[[_TOC_]]' || t === '[TOC]' ? TOC_MARK : l
  }).join('\n')
}

export function tocHtml(headings: Heading[]): string {
  const hs = headings.filter((h) => h.depth <= 4); if (!hs.length) return ''
  const min = Math.min(...hs.map((h) => h.depth))
  return `<nav class="toc"><div class="toc-title">Contents</div>${hs.map((h) => `<div class="toc-i toc-${h.depth - min}"><a href="#${h.id}">${esc(h.text)}</a></div>`).join('')}</nav>`
}

export type Highlighter = (code: string, lang: string) => string | null

/** Markdown -> sanitized HTML. Mermaid blocks become `<div class="mmd" data-idx="n">` placeholders. */
export function renderMarkdown(md: string, highlight?: Highlighter): Rendered {
  const headings: Heading[] = []; const diagrams: string[] = []; const seen = new Map<string, number>()
  const marked = new Marked({ gfm: true, renderer: {
    code({ text, lang }) {
      const l = (lang ?? '').split(/\s+/)[0].toLowerCase()
      if (l === 'mermaid') { diagrams.push(text); return `<div class="mmd" data-idx="${diagrams.length - 1}"></div>` }
      const hl = l && highlight ? highlight(text, l) : null
      return `<pre><code${l ? ` class="language-${esc(l)}"` : ''}>${hl ?? esc(text)}\n</code></pre>`
    },
    heading({ tokens, depth, text }) {
      const base = slugify(text); const n = seen.get(base) ?? 0; seen.set(base, n + 1)
      const id = n ? `${base}-${n}` : base
      headings.push({ depth, text: text.replace(/<[^>]+>/g, ''), id })
      return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`
    },
  } })
  let html = marked.parse(markToc(azureToFences(md)), { async: false }) as string
  html = html.replace(TOC_P, () => tocHtml(headings))
  html = DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, ADD_ATTR: ['data-idx'] })
  return { html, headings, diagrams }
}

// ---------- SVG helpers ----------
export function svgSize(svg: string): { w: number; h: number } {
  const vb = /viewBox="\s*[-\d.e]+[ ,]+[-\d.e]+[ ,]+([\d.e]+)[ ,]+([\d.e]+)\s*"/i.exec(svg)
  if (vb) return { w: Math.ceil(parseFloat(vb[1])), h: Math.ceil(parseFloat(vb[2])) }
  const w = /<svg[^>]*\swidth="([\d.]+)/i.exec(svg), h = /<svg[^>]*\sheight="([\d.]+)/i.exec(svg)
  return { w: w ? Math.ceil(parseFloat(w[1])) : 800, h: h ? Math.ceil(parseFloat(h[1])) : 600 }
}
/** Gives the root <svg> explicit pixel size (mermaid emits width="100%") and an XML namespace so it works standalone. */
export function normalizeSvg(svg: string, bg?: string): string {
  const { w, h } = svgSize(svg)
  return svg.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
    let a = attrs.replace(/\s(width|height)="[^"]*"/gi, '').replace(/\sstyle="[^"]*"/i, (s) => s.replace(/max-width:[^;"]*;?/i, '').replace(/background[^;"]*;?/i, ''))
    if (!/xmlns=/.test(a)) a += ' xmlns="http://www.w3.org/2000/svg"'
    const style = bg ? ` style="background:${bg}"` : ''
    return `<svg${a.replace(/\sstyle=""/, '')} width="${w}" height="${h}"${/\sstyle=/.test(a) ? '' : style}>`
  })
}

// ---------- document CSS (shared by preview, PDF, Word, HTML) ----------
export const DOC_CSS = `
.mdv{font-family:"Segoe UI",Calibri,Helvetica,Arial,sans-serif;font-size:11pt;line-height:1.55;color:#1f2328;word-wrap:break-word}
.mdv h1,.mdv h2,.mdv h3,.mdv h4,.mdv h5,.mdv h6{font-weight:600;line-height:1.25;margin:1.4em 0 .5em;color:#111;page-break-after:avoid}
.mdv h1{font-size:2em;border-bottom:1px solid #d0d7de;padding-bottom:.3em;margin-top:0}.mdv h2{font-size:1.5em;border-bottom:1px solid #d8dee4;padding-bottom:.25em}
.mdv h3{font-size:1.25em}.mdv h4{font-size:1.05em}.mdv h5,.mdv h6{font-size:.95em;color:#57606a}
.mdv p,.mdv ul,.mdv ol,.mdv blockquote,.mdv table,.mdv pre{margin:0 0 1em}
.mdv ul{list-style:disc;padding-left:2em}.mdv ol{list-style:decimal;padding-left:2em}.mdv li>ul,.mdv li>ol{margin:0}.mdv li{margin:.2em 0}
.mdv li:has(>input[type=checkbox]){list-style:none;margin-left:-1.4em}.mdv input[type=checkbox]{margin-right:.45em}
.mdv a{color:#0969da;text-decoration:none}.mdv a:hover{text-decoration:underline}
.mdv code{font-family:Consolas,"SF Mono",Menlo,monospace;font-size:.88em;background:#eff1f3;padding:.15em .35em;border-radius:4px}
.mdv pre{background:#f6f8fa;border:1px solid #d8dee4;border-radius:6px;padding:.8em 1em;overflow:auto;line-height:1.45;page-break-inside:avoid;white-space:pre-wrap;word-break:break-word}
.mdv pre code{background:none;padding:0;font-size:.85em}
.mdv blockquote{border-left:4px solid #d0d7de;padding:.1em 1em;color:#57606a}
.mdv table{border-collapse:collapse;width:auto;max-width:100%;page-break-inside:auto}.mdv tr{page-break-inside:avoid}
.mdv th,.mdv td{border:1px solid #d0d7de;padding:.4em .8em;text-align:left}.mdv th{background:#f6f8fa;font-weight:600}
.mdv tr:nth-child(even) td{background:#fafbfc}
.mdv img{max-width:100%}.mdv hr{border:0;border-top:1px solid #d0d7de;margin:1.6em 0}
.mdv .toc{border:1px solid #d8dee4;background:#f6f8fa;border-radius:6px;padding:.7em 1.1em;margin:0 0 1.4em;page-break-inside:avoid}
.mdv .toc-title{font-weight:600;margin-bottom:.3em}.mdv .toc-i{margin:.1em 0}.mdv .toc-1{padding-left:1.2em}.mdv .toc-2{padding-left:2.4em}.mdv .toc-3{padding-left:3.6em}
.mdv figure.diagram{margin:1.2em 0;text-align:center;page-break-inside:avoid}.mdv figure.diagram svg,.mdv figure.diagram img{max-width:100%;height:auto}
.mdv figure.diagram-error{border:1px solid #cf222e;background:#fff5f5;border-radius:6px;padding:.6em 1em;page-break-inside:avoid}
.mdv figure.diagram-error figcaption{color:#cf222e;font-weight:600;margin-bottom:.4em}
.hljs-comment,.hljs-quote{color:#6e7781;font-style:italic}.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-built_in,.hljs-type{color:#cf222e}
.hljs-string,.hljs-regexp,.hljs-addition{color:#0a3069}.hljs-number,.hljs-symbol,.hljs-bullet{color:#0550ae}
.hljs-title,.hljs-section,.hljs-function .hljs-title{color:#8250df}.hljs-attr,.hljs-attribute,.hljs-variable,.hljs-template-variable{color:#116329}
.hljs-meta,.hljs-tag,.hljs-name{color:#116329}.hljs-deletion{color:#82071e}
`

export type PageSize = 'A4' | 'Letter'

/** Replaces diagram placeholders with the rendered figures (inline SVG, or <img> via `img`). */
export function inlineDiagrams(html: string, results: ({ svg: string; bg?: string } | { error: string; code: string })[], img?: (i: number) => string | null): string {
  return html.replace(/<div class="mmd" data-idx="(\d+)"><\/div>/g, (_m, n: string) => {
    const r = results[Number(n)]; if (!r) return ''
    if ('error' in r) return `<figure class="diagram-error"><figcaption>Diagram could not be rendered: ${esc(r.error)}</figcaption><pre><code>${esc(r.code)}</code></pre></figure>`
    const im = img?.(Number(n)); if (im) return `<figure class="diagram">${im}</figure>`
    const bg = r.bg && r.bg !== '#ffffff' ? `;background:${r.bg};padding:12px;border-radius:6px` : ''
    return `<figure class="diagram" style="margin:1.2em 0${bg}">${normalizeSvg(r.svg)}</figure>`
  })
}

export function standaloneHtml(title: string, body: string, opts: { size?: PageSize; extraHead?: string } = {}): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${opts.extraHead ?? ''}<style>@page{size:${opts.size ?? 'A4'};margin:18mm 16mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#fff}.mdv{max-width:880px;margin:0 auto;padding:24px}@media print{.mdv{max-width:none;padding:0}}${DOC_CSS}</style></head><body><article class="mdv">${body}</article></body></html>`
}

// ---------- Word (MHTML .doc) ----------
const b64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s) }
const wrap76 = (s: string) => s.replace(/.{1,76}/g, '$&\r\n')

export interface WordImage { name: string; mime: string; data: Uint8Array; w: number; h: number }
/** Builds a Word-openable MHTML document: one HTML part plus the diagram PNGs as related parts. */
export function buildWordMhtml(title: string, body: string, images: WordImage[], size: PageSize = 'A4'): string {
  const boundary = `----=_NextPart_devpocket_${Date.now().toString(36)}`
  const page = size === 'A4' ? '21cm 29.7cm' : '21.59cm 27.94cm'
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page WordSection1{size:${page};margin:2cm 1.8cm;mso-page-orientation:portrait}div.WordSection1{page:WordSection1}${DOC_CSS}</style></head><body><div class="WordSection1"><article class="mdv">${body}</article></div></body></html>`
  const parts = [
    `MIME-Version: 1.0\r\nContent-Type: multipart/related; type="text/html"; boundary="${boundary}"\r\n`,
    `--${boundary}\r\nContent-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: base64\r\nContent-Location: file:///C:/devpocket/document.htm\r\n\r\n${wrap76(b64(new TextEncoder().encode(html)))}`,
    ...images.map((im) => `--${boundary}\r\nContent-Type: ${im.mime}\r\nContent-Transfer-Encoding: base64\r\nContent-Location: file:///C:/devpocket/${im.name}\r\n\r\n${wrap76(b64(im.data))}`),
    `--${boundary}--\r\n`,
  ]
  return parts.join('\r\n')
}
export const wordImgTag = (name: string, w: number, h: number, alt: string) => {
  const maxW = 600; const k = w > maxW ? maxW / w : 1
  return `<img src="file:///C:/devpocket/${name}" width="${Math.round(w * k)}" height="${Math.round(h * k)}" alt="${esc(alt)}" style="width:${Math.round(w * k)}px;height:${Math.round(h * k)}px">`
}

export const docTitle = (md: string) => /^#\s+(.+?)\s*#*$/m.exec(md)?.[1].replace(/[*_`[\]]/g, '') || 'document'
export const fileSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'document'
