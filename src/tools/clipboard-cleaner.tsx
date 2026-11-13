import { TransformTool } from '@/components/kit'
import { cleanClipboard } from '@/lib/text'

export default function ClipboardCleaner() {
  return <TransformTool sample={'  • “Smart quotes” — and   extra   spaces\u200b  \n\n\n\n  <b>HTML</b> &amp; **markdown** here\u00a0 \n  2) numbered item  '} filename="cleaned.txt"
    notice={{ kind: 'info', text: 'Pasting into the input box already removes rich-text formatting (fonts, colors, links). Choose what else to clean below.' }}
    options={[
      { key: 'removeInvisible', label: 'Remove invisible chars / odd spaces', type: 'check', default: true }, { key: 'collapseSpaces', label: 'Collapse duplicate spaces', type: 'check', default: true }, { key: 'trimLines', label: 'Trim each line', type: 'check', default: true },
      { key: 'collapseBlank', label: 'Collapse blank lines', type: 'check', default: true }, { key: 'removeBlank', label: 'Remove all blank lines', type: 'check', default: false }, { key: 'straightQuotes', label: 'Straighten quotes & dashes', type: 'check', default: false },
      { key: 'stripHtml', label: 'Strip HTML tags', type: 'check', default: false }, { key: 'stripMarkdown', label: 'Strip Markdown', type: 'check', default: false }, { key: 'stripBullets', label: 'Remove bullets/numbering', type: 'check', default: false }, { key: 'joinLines', label: 'Join lines into one paragraph', type: 'check', default: false }, { key: 'tabs', label: 'Tabs → spaces', type: 'check', default: false },
    ]}
    run={(i, o) => cleanClipboard(i, o as never)} />
}
