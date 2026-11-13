import { TransformTool, Stat, Grid } from '@/components/kit'
import { dedupeLines } from '@/lib/text'

export default function TextDedupe() {
  return <TransformTool sample={'apple\nBanana\napple\ncherry\nbanana\n\napple\ndate'} filename="unique.txt"
    options={[
      { key: 'ignoreCase', label: 'Ignore case', type: 'check', default: false }, { key: 'trim', label: 'Trim whitespace', type: 'check', default: true }, { key: 'keepEmpty', label: 'Keep empty lines', type: 'check', default: false },
      { key: 'sort', label: 'Order', type: 'select', default: '', options: [['', 'Preserve original order'], ['asc', 'Sort A → Z'], ['desc', 'Sort Z → A']] },
      { key: 'onlyDuplicates', label: 'Show only lines that were duplicated', type: 'check', default: false }, { key: 'counts', label: 'Prefix with occurrence count', type: 'check', default: false },
    ]}
    run={(i, o) => dedupeLines(i, o as never).text}
    extra={(i, _o, o) => { if (!i.trim()) return null; const r = dedupeLines(i, o as never); return <Grid cols={3}><Stat label="Total lines" value={r.total} /><Stat label="Unique" value={r.unique} tone="ok" /><Stat label="Removed" value={r.removed} tone={r.removed ? 'warn' : undefined} /></Grid> }} />
}
