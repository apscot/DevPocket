import { TransformTool } from '@/components/kit'
import { parseJson } from '@/lib/json'
import { jsonToCsv } from '@/lib/csv'

const sample = `[
  {"id":1,"name":"Ada","address":{"city":"London"},"tags":["a","b"]},
  {"id":2,"name":"Grace","email":"grace@example.com"}
]`
export default function JsonToCsv() {
  return (
    <TransformTool
      sample={sample} filename="data.csv" mime="text/csv" accept=".json"
      options={[
        { key: 'delimiter', label: 'Delimiter', type: 'select', default: ',', options: [[',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab'], ['|', 'Pipe']] },
        { key: 'flatten', label: 'Flatten nested objects', type: 'check', default: true },
        { key: 'separator', label: 'Key separator', type: 'text', default: '.', show: (o) => o.flatten },
        { key: 'arrays', label: 'Arrays', type: 'select', default: 'json', options: [['json', 'As JSON string'], ['index', 'Expand by index']], show: (o) => o.flatten },
        { key: 'header', label: 'Header row', type: 'check', default: true },
      ]}
      run={(i, o) => jsonToCsv(parseJson(i), { delimiter: o.delimiter, flatten: o.flatten, separator: o.separator || '.', arrays: o.arrays, header: o.header })}
    />
  )
}
