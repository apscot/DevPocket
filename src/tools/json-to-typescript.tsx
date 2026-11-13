import { TransformTool } from '@/components/kit'
import { parseJson } from '@/lib/json'
import { toTypeScript } from '@/lib/shape'
import { SAMPLE_JSON } from '@/lib/samples'

export default function JsonToTs() {
  return (
    <TransformTool
      sample={SAMPLE_JSON} filename="types.ts" mime="text/typescript"
      options={[
        { key: 'rootName', label: 'Root type name', type: 'text', default: 'Root' },
        { key: 'style', label: 'Style', type: 'select', default: 'interface', options: [['interface', 'interface'], ['type', 'type alias']] },
        { key: 'exportKw', label: 'export', type: 'check', default: true },
        { key: 'readonly', label: 'readonly', type: 'check', default: false },
        { key: 'allOptional', label: 'All optional', type: 'check', default: false },
      ]}
      run={(i, o) => toTypeScript(parseJson(i), o)}
    />
  )
}
