import { TransformTool } from '@/components/kit'
import { csvToJson } from '@/lib/csv'
import { SAMPLE_CSV } from '@/lib/samples'

export default function CsvToJson() {
  return (
    <TransformTool
      sample={SAMPLE_CSV} filename="data.json" mime="application/json" accept=".csv,.tsv,.txt"
      options={[
        { key: 'delimiter', label: 'Delimiter', type: 'select', default: 'auto', options: [['auto', 'Auto-detect'], [',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab'], ['|', 'Pipe']] },
        { key: 'header', label: 'First row is header', type: 'check', default: true },
        { key: 'infer', label: 'Infer numbers/booleans', type: 'check', default: true },
        { key: 'trim', label: 'Trim values', type: 'check', default: false },
      ]}
      run={(i, o) => JSON.stringify(csvToJson(i, o), null, 2)}
      success={(out) => `${(JSON.parse(out) as unknown[]).length} records`}
    />
  )
}
