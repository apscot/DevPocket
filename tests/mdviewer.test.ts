import { describe, expect, it } from 'vitest'
import { azureToFences, buildWordMhtml, docTitle, inlineDiagrams, normalizeSvg, renderMarkdown, svgSize, toAzureWiki, withToc, wordImgTag } from '../src/lib/mdviewer'

const MM = 'flowchart TD\n  A-->B'
describe('Azure DevOps wiki conversion', () => {
  it('turns mermaid fences into ::: mermaid blocks with blank lines around them', () => {
    const out = toAzureWiki(`# T\ntext\n\`\`\`mermaid\n${MM}\n\`\`\`\nafter`)
    expect(out).toBe(`# T\ntext\n\n::: mermaid\n${MM}\n:::\n\nafter\n`)
  })
  it('leaves other fences and nested mermaid examples alone', () => {
    const md = '````md\n```mermaid\nA-->B\n```\n````\n\n```js\nx\n```\n'
    expect(toAzureWiki(md)).toBe(md)
  })
  it('adds [[_TOC_]] once and round-trips back to fences', () => {
    expect(toAzureWiki('# A', { toc: true }).startsWith('[[_TOC_]]\n\n# A')).toBe(true)
    expect(withToc(withToc('# A')).match(/_TOC_/g)).toHaveLength(1)
    const az = toAzureWiki(`\`\`\`mermaid\n${MM}\n\`\`\``)
    expect(azureToFences(az)).toContain('```mermaid\nflowchart TD\n  A-->B\n```')
  })
})
describe('markdown rendering', () => {
  it('extracts mermaid diagrams (fenced and Azure style) as placeholders', () => {
    const r = renderMarkdown(`# Hi\n\n\`\`\`mermaid\n${MM}\n\`\`\`\n\n::: mermaid\nsequenceDiagram\n  A->>B: x\n:::\n`)
    expect(r.diagrams).toHaveLength(2)
    expect(r.html).toContain('<div class="mmd" data-idx="0"></div>')
    expect(r.html).toContain('data-idx="1"')
  })
  it('sanitizes scripts, builds heading ids and a TOC', () => {
    const r = renderMarkdown('[[_TOC_]]\n\n# One\n## Two\n## Two\n<script>alert(1)</script><img src=x onerror=alert(1)>')
    expect(r.html).not.toMatch(/<script|onerror/)
    expect(r.headings.map((h) => h.id)).toEqual(['one', 'two', 'two-1'])
    expect(r.html).toContain('class="toc"'); expect(r.html).toContain('href="#two-1"')
  })
  it('exports task lists, tables and code', () => {
    const r = renderMarkdown('- [x] a\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nlet x\n```', (c) => `<span class="hljs-keyword">${c}</span>`)
    expect(r.html).toContain('type="checkbox"'); expect(r.html).toContain('<table>'); expect(r.html).toContain('hljs-keyword')
  })
  it('titles documents', () => { expect(docTitle('x\n# My **Doc**\n')).toBe('My Doc'); expect(docTitle('no heading')).toBe('document') })
})
describe('svg + word export', () => {
  const svg = '<svg id="m" width="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320.5 140" style="max-width: 320.5px;"><g/></svg>'
  it('reads size and gives the root explicit dimensions', () => {
    expect(svgSize(svg)).toEqual({ w: 321, h: 140 })
    const n = normalizeSvg(svg)
    expect(n).toContain('width="321"'); expect(n).toContain('height="140"'); expect(n).not.toContain('100%'); expect(n).not.toContain('max-width')
  })
  it('replaces placeholders with figures, images or error boxes', () => {
    const html = '<div class="mmd" data-idx="0"></div><div class="mmd" data-idx="1"></div>'
    const out = inlineDiagrams(html, [{ svg, bg: '#ffffff' }, { error: 'Parse <bad>', code: 'x' }])
    expect(out).toContain('<svg'); expect(out).toContain('diagram-error'); expect(out).toContain('Parse &lt;bad&gt;')
    expect(inlineDiagrams(html, [{ svg, bg: '#fff' }, { svg, bg: '#fff' }], (i) => `<img data-i="${i}">`)).toContain('<img data-i="1">')
  })
  it('builds a Word-readable MHTML with related image parts', () => {
    const mht = buildWordMhtml('T & Co', '<p>hi</p>' + wordImgTag('d1.png', 1200, 600, 'Diagram'), [{ name: 'd1.png', mime: 'image/png', data: new Uint8Array([137, 80, 78, 71]), w: 1200, h: 600 }])
    expect(mht).toMatch(/^MIME-Version: 1.0/); expect(mht).toContain('multipart/related'); expect(mht).toContain('Content-Location: file:///C:/devpocket/d1.png')
    expect(mht).toContain('iVBORw==')
    expect(wordImgTag('d1.png', 1200, 600, 'x')).toContain('width="600" height="300"')
  })
})
