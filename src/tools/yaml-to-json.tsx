import * as yaml from 'js-yaml'
import { TransformTool } from '@/components/kit'
import { SAMPLE_YAML } from '@/lib/samples'
import { yamlErrorMessage } from '@/lib/yamlutil'

export default function YamlToJson() {
  return (
    <TransformTool sample={SAMPLE_YAML} filename="output.json" mime="application/json" accept=".yml,.yaml"
      options={[{ key: 'indent', label: 'Indent', type: 'select', default: '2', options: [['2', '2'], ['4', '4'], ['0', 'Minified']] }, { key: 'all', label: 'Multi-document → array', type: 'check', default: true }]}
      run={(i, o) => { try { const docs = yaml.loadAll(i); const v = docs.length > 1 && o.all ? docs : docs[0]; return JSON.stringify(v ?? null, null, Number(o.indent)) } catch (e) { throw new Error(yamlErrorMessage(e)) } }} />
  )
}
