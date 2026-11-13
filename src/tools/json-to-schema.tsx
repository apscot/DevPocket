import { TransformTool } from '@/components/kit'
import { parseJson } from '@/lib/json'
import { inferShape, toJsonSchema } from '@/lib/shape'
import { SAMPLE_JSON } from '@/lib/samples'

export default function JsonToSchema() {
  return (
    <TransformTool
      sample={SAMPLE_JSON} filename="schema.json" mime="application/json"
      options={[
        { key: 'required', label: 'Mark always-present properties as required', type: 'check', default: true },
        { key: 'additional', label: 'additionalProperties: false', type: 'check', default: false },
      ]}
      run={(i, o) => {
        const s = toJsonSchema(inferShape(parseJson(i)), true, o.required)
        const fix = (n: any): any => { if (Array.isArray(n)) return n.map(fix); if (n && typeof n === 'object') { const r: any = Object.fromEntries(Object.entries(n).map(([k, v]) => [k, k === 'properties' ? Object.fromEntries(Object.entries(v as object).map(([a, b]) => [a, fix(b)])) : fix(v)])); if (o.additional && r.type === 'object') r.additionalProperties = false; return r } return n }
        return JSON.stringify(fix(s), null, 2)
      }}
    />
  )
}
