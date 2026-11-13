import { TransformTool } from '@/components/kit'
import { textToolbox, type ToolboxOpts } from '@/lib/text'

export default function TextToolbox() {
  return <TransformTool sample={'  banana  \n apple\n\n\n  Cherry\napple\n  éclair  '} filename="text.txt"
    notice={{ kind: 'info', text: 'Options are applied in this order: normalize → trim → collapse → blank lines → case → unique → sort → reverse → wrap → numbering → prefix/suffix → join.' }}
    options={[
      { key: 'trimLines', label: 'Trim each line', type: 'check', default: true }, { key: 'collapseSpaces', label: 'Collapse repeated spaces', type: 'check', default: false },
      { key: 'removeBlank', label: 'Remove blank lines', type: 'check', default: false }, { key: 'collapseBlank', label: 'Collapse multiple blank lines', type: 'check', default: false, show: (o) => !o.removeBlank },
      { key: 'normalize', label: 'Unicode normalize', type: 'select', default: '', options: [['', 'None'], ['NFC', 'NFC'], ['NFD', 'NFD'], ['NFKC', 'NFKC'], ['NFKD', 'NFKD']] }, { key: 'stripAccents', label: 'Strip accents', type: 'check', default: false },
      { key: 'caseMode', label: 'Case', type: 'select', default: '', options: [['', 'Unchanged'], ['upper', 'UPPER'], ['lower', 'lower'], ['title', 'Title'], ['sentence', 'Sentence']] },
      { key: 'unique', label: 'Unique lines', type: 'check', default: false },
      { key: 'sort', label: 'Sort', type: 'select', default: '', options: [['', 'None'], ['asc', 'A → Z'], ['desc', 'Z → A'], ['natural', 'Natural (numbers)'], ['length', 'By length']] }, { key: 'sortIgnoreCase', label: 'Ignore case (sort/unique)', type: 'check', default: false },
      { key: 'reverse', label: 'Reverse', type: 'select', default: '', options: [['', 'None'], ['lines', 'Line order'], ['chars', 'Characters in each line'], ['words', 'Words in each line']] },
      { key: 'wrap', label: 'Wrap at columns (0 = off)', type: 'number', default: 0, min: 0 }, { key: 'numberLines', label: 'Number lines', type: 'check', default: false },
      { key: 'prefix', label: 'Prefix', type: 'text', default: '' }, { key: 'suffix', label: 'Suffix', type: 'text', default: '' }, { key: 'join', label: 'Join with (e.g. , or \\t)', type: 'text', default: '' },
    ]}
    run={(i, o) => textToolbox(i, o as ToolboxOpts)} />
}
