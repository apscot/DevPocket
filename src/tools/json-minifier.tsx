import { TransformTool, Stat, Grid } from '@/components/kit'
import { minifyJson } from '@/lib/json'
import { byteLength, fmtBytes } from '@/lib/util'
import { SAMPLE_JSON } from '@/lib/samples'

export default function JsonMinifier() {
  return (
    <TransformTool
      sample={SAMPLE_JSON} filename="minified.json" mime="application/json" run={(i) => minifyJson(i)} success={() => 'Valid JSON'}
      extra={(i, o) => o ? (() => { const a = byteLength(i), b = byteLength(o); return (
        <Grid cols={3}><Stat label="Input size" value={fmtBytes(a)} /><Stat label="Minified size" value={fmtBytes(b)} /><Stat label="Saved" value={`${a ? (((a - b) / a) * 100).toFixed(1) : 0}%`} tone="ok" /></Grid>) })() : null}
    />
  )
}
