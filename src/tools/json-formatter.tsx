import { TransformTool } from '@/components/kit'
import { formatJson, minifyJson } from '@/lib/json'
import { SAMPLE_JSON } from '@/lib/samples'

export default function JsonFormatter() {
  return (
    <TransformTool
      sample={SAMPLE_JSON} placeholder='{"paste": "JSON here"}' accept=".json,application/json,text/plain" filename="formatted.json" mime="application/json"
      options={[
        { key: 'mode', label: 'Mode', type: 'select', default: 'format', options: [['format', 'Format (pretty)'], ['minify', 'Minify']] },
        { key: 'indent', label: 'Indent', type: 'select', default: '2', options: [['2', '2 spaces'], ['4', '4 spaces'], ['8', '8 spaces'], ['tab', 'Tab']], show: (o) => o.mode === 'format' },
        { key: 'sort', label: 'Sort keys', type: 'check', default: false },
      ]}
      run={(i, o) => (o.mode === 'minify' ? (o.sort ? formatJson(i, 0, true).replace(/\n/g, '') : minifyJson(i)) : formatJson(i, o.indent === 'tab' ? 'tab' : Number(o.indent), o.sort))}
      success={() => 'Valid JSON'}
    />
  )
}
