import { TransformTool } from '@/components/kit'
import { parseJson } from '@/lib/json'
import { toProto } from '@/lib/proto'
import { SAMPLE_JSON } from '@/lib/samples'

export default function JsonToProto() {
  return <TransformTool sample={SAMPLE_JSON} filename="schema.proto" mime="text/plain"
    options={[
      { key: 'rootName', label: 'Root message', type: 'text', default: 'User' }, { key: 'pkg', label: 'Package', type: 'text', default: 'com.example.api' },
      { key: 'javaPackage', label: 'java_package (optional)', type: 'text', default: '' }, { key: 'goPackage', label: 'go_package (optional)', type: 'text', default: '' },
      { key: 'optional', label: 'Use `optional` for nullable/missing fields', type: 'check', default: true },
    ]}
    run={(i, o) => toProto(parseJson(i), o as never)}
    emptyHint="Paste a JSON object to generate proto3 messages. Field numbers are assigned in order; review them before using in production." />
}
