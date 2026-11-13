import { TransformTool } from '@/components/kit'
import { htmlDecode, htmlEncode } from '@/lib/encode'

export default function HtmlEntities() {
  return <TransformTool sample={'<a href="/search?q=a&b">Café — “quoted” © 2024 → ✓ 😀</a>'} filename="entities.txt"
    options={[
      { key: 'dir', label: 'Direction', type: 'select', default: 'encode', options: [['encode', 'Encode'], ['decode', 'Decode']] },
      { key: 'nonAscii', label: 'Non-ASCII characters', type: 'select', default: 'none', options: [['none', 'Leave as is'], ['named', 'Named where possible'], ['decimal', 'Numeric (&#233;)'], ['hex', 'Hex (&#xE9;)']], show: (o) => o.dir === 'encode' },
      { key: 'quotes', label: 'Escape quotes', type: 'check', default: true, show: (o) => o.dir === 'encode' },
    ]}
    run={(i, o) => (o.dir === 'encode' ? htmlEncode(i, { nonAscii: o.nonAscii, quotes: o.quotes }) : htmlDecode(i))} />
}
