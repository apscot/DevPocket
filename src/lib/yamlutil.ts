import * as yaml from 'js-yaml'
export function yamlErrorMessage(e: unknown): string {
  if (e instanceof yaml.YAMLException) {
    const m = e.mark
    return `${e.reason}${m ? ` (line ${m.line + 1}, column ${m.column + 1})` : ''}${m?.snippet ? '\n\n' + m.snippet : ''}`
  }
  return e instanceof Error ? e.message : String(e)
}
export function validateYaml(text: string): { ok: boolean; docs: number; error?: string; line?: number; column?: number } {
  try { const d = yaml.loadAll(text); return { ok: true, docs: d.length } } catch (e) {
    const m = e instanceof yaml.YAMLException ? e.mark : undefined
    return { ok: false, docs: 0, error: yamlErrorMessage(e), line: m ? m.line + 1 : undefined, column: m ? m.column + 1 : undefined }
  }
}
export function formatYaml(text: string, indent = 2, sort = false, lineWidth = -1): string {
  try { return yaml.loadAll(text).map((d) => yaml.dump(d, { indent, sortKeys: sort, lineWidth, noRefs: true })).join('---\n') } catch (e) { throw new Error(yamlErrorMessage(e)) }
}
