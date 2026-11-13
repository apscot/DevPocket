import { TransformTool } from '@/components/kit'
import { urlDecode, urlEncode, type UrlMode } from '@/lib/encode'

export default function UrlEncoder() {
  return <TransformTool sample={'https://example.com/search?q=hello world&lang=en&name=José'} filename="url.txt"
    options={[
      { key: 'dir', label: 'Direction', type: 'select', default: 'encode', options: [['encode', 'Encode'], ['decode', 'Decode']] },
      { key: 'mode', label: 'Scope', type: 'select', default: 'component', options: [['component', 'Component (encodeURIComponent)'], ['full', 'Full URL (encodeURI)'], ['form', 'Form (spaces → +)']] },
    ]}
    run={(i, o) => (o.dir === 'encode' ? urlEncode(i, o.mode as UrlMode) : urlDecode(i, o.mode as UrlMode))} />
}
