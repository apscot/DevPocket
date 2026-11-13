import { TransformTool } from '@/components/kit'
import { formatYaml } from '@/lib/yamlutil'

const SAMPLE = `server:
    port:   8080
    paths: [ "/a",   "/b" ]
spring: {profiles: {active: dev}}
list:
- a
-   b
`
export default function YamlFormatter() {
  return <TransformTool sample={SAMPLE} filename="formatted.yaml" mime="text/yaml" accept=".yml,.yaml" success={() => 'Valid YAML'}
    options={[{ key: 'indent', label: 'Indent', type: 'select', default: '2', options: [['2', '2 spaces'], ['4', '4 spaces']] }, { key: 'sort', label: 'Sort keys', type: 'check', default: false }]}
    run={(i, o) => formatYaml(i, Number(o.indent), o.sort)} />
}
