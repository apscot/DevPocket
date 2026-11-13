import { TransformTool } from '@/components/kit'
import { parseJson } from '@/lib/json'
import { toJava } from '@/lib/shape'
import { SAMPLE_JSON } from '@/lib/samples'

export default function JsonToJava() {
  return (
    <TransformTool
      sample={SAMPLE_JSON} filename="Root.java" mime="text/x-java-source"
      options={[
        { key: 'pkg', label: 'Package', type: 'text', default: 'com.example.dto' },
        { key: 'rootName', label: 'Root class', type: 'text', default: 'User' },
        { key: 'style', label: 'Style', type: 'select', default: 'pojo', options: [['pojo', 'POJO (getters/setters)'], ['lombok', 'Lombok @Data'], ['record', 'Java record']] },
        { key: 'jackson', label: 'Jackson annotations', type: 'check', default: true },
        { key: 'primitives', label: 'Use primitives for required fields', type: 'check', default: false },
        { key: 'chaining', label: 'Fluent setters', type: 'check', default: false, show: (o) => o.style === 'pojo' },
      ]}
      run={(i, o) => toJava(parseJson(i), o as never)}
    />
  )
}
