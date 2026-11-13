import { ConfigCompare } from '@/components/ConfigCompare'
import { parseConfig } from '@/lib/config'
import { SAMPLE_YAML, SAMPLE_YAML_B } from '@/lib/samples'

const parse = (t: string, f: string, n: string) => (t.trim() ? parseConfig(t, f as 'auto', n) : new Map())
export default function SpringCompare() {
  return <ConfigCompare parse={parse} sampleA={SAMPLE_YAML} sampleB={SAMPLE_YAML_B} labelA="Base (left)" labelB="Target (right)" relaxedOption accept=".yml,.yaml,.properties,.txt"
    formats={[['auto', 'Auto-detect'], ['yaml', 'YAML'], ['properties', '.properties']]} />
}
