import * as yaml from 'js-yaml'
import { TransformTool } from '@/components/kit'
import { parseJson } from '@/lib/json'
import { SAMPLE_JSON } from '@/lib/samples'

export default function JsonToYaml() {
  return (
    <TransformTool sample={SAMPLE_JSON} filename="output.yaml" mime="text/yaml"
      options={[{ key: 'indent', label: 'Indent', type: 'select', default: '2', options: [['2', '2'], ['4', '4']] }, { key: 'sort', label: 'Sort keys', type: 'check', default: false }]}
      run={(i, o) => yaml.dump(parseJson(i), { indent: Number(o.indent), sortKeys: o.sort, lineWidth: -1, noRefs: true })} />
  )
}
