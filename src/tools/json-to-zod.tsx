import { TransformTool } from '@/components/kit'
import { parseJson } from '@/lib/json'
import { toZod } from '@/lib/shape'
import { SAMPLE_JSON } from '@/lib/samples'

export default function JsonToZod() {
  return (
    <TransformTool
      sample={SAMPLE_JSON} filename="schema.ts" mime="text/typescript"
      options={[
        { key: 'name', label: 'Schema name', type: 'text', default: 'User', hint: 'Becomes <Name>Schema' },
        { key: 'exportKw', label: 'export', type: 'check', default: true },
        { key: 'inferType', label: 'Add z.infer type', type: 'check', default: true },
      ]}
      run={(i, o) => toZod(parseJson(i), o)}
    />
  )
}
