import { TransformTool } from '@/components/kit'
import { b64ToBytes, bytesToB64, bytesToHex, hexToBytes } from '@/lib/encode'

export default function Base64Hex() {
  return <TransformTool sample="SGVsbG8sIFdvcmxkIQ==" filename="converted.txt"
    options={[
      { key: 'dir', label: 'Direction', type: 'select', default: 'b2h', options: [['b2h', 'Base64 → Hex'], ['h2b', 'Hex → Base64']] },
      { key: 'sep', label: 'Hex separator', type: 'select', default: '', options: [['', 'None'], [' ', 'Space'], [':', 'Colon'], ['-', 'Dash']], show: (o) => o.dir === 'b2h' },
      { key: 'upper', label: 'Uppercase', type: 'check', default: false, show: (o) => o.dir === 'b2h' },
      { key: 'urlSafe', label: 'URL-safe Base64', type: 'check', default: false, show: (o) => o.dir === 'h2b' },
    ]}
    run={(i, o) => (o.dir === 'b2h' ? bytesToHex(b64ToBytes(i), o.sep, o.upper) : bytesToB64(hexToBytes(i), o.urlSafe))} />
}
