import { TransformTool } from '@/components/kit'
import { escapeJsonString, unescapeJsonString } from '@/lib/json'

export default function JsonEscape() {
  return (
    <TransformTool
      placeholder={'Text to escape, or a JSON string like "line1\\nline2"'} filename="output.txt"
      sample={'{"message": "He said \\"hi\\"", "path": "C:\\\\temp"}'}
      options={[
        { key: 'mode', label: 'Mode', type: 'select', default: 'escape', options: [['escape', 'Escape'], ['unescape', 'Unescape']] },
        { key: 'quotes', label: 'Wrap in quotes', type: 'check', default: false, show: (o) => o.mode === 'escape' },
      ]}
      run={(i, o) => (o.mode === 'escape' ? (o.quotes ? `"${escapeJsonString(i)}"` : escapeJsonString(i)) : unescapeJsonString(i))}
    />
  )
}
