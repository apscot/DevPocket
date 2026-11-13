import { useState } from 'react'
import { CopyButton, DownloadButton, Empty, FileButton, Panel, Tabs, TransformTool, Textarea } from '@/components/kit'
import { b64decodeText, b64encodeText, bytesToB64 } from '@/lib/encode'
import { fmtBytes } from '@/lib/util'

export default function Base64Tool() {
  const [tab, setTab] = useState<'text' | 'file'>('text')
  const [file, setFile] = useState<{ name: string; size: number; b64: string; type: string } | null>(null)
  const [urlSafe, setUrlSafe] = useState(false)
  const onFile = async (f: File) => setFile({ name: f.name, size: f.size, type: f.type, b64: bytesToB64(new Uint8Array(await f.arrayBuffer()), urlSafe) })
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={tab} onChange={setTab} items={[['text', 'Text'], ['file', 'File → Base64']]} />
      {tab === 'text' ? (
        <TransformTool sample="Hello, Wörld! 你好 👋" filename="output.txt"
          options={[{ key: 'dir', label: 'Direction', type: 'select', default: 'encode', options: [['encode', 'Encode'], ['decode', 'Decode']] }, { key: 'urlSafe', label: 'URL-safe alphabet', type: 'check', default: false, show: (o) => o.dir === 'encode' }, { key: 'pad', label: 'Keep = padding', type: 'check', default: true, show: (o) => o.dir === 'encode' }]}
          run={(i, o) => (o.dir === 'encode' ? b64encodeText(i, o.urlSafe, o.pad) : b64decodeText(i))}
          notice={{ kind: 'info', text: 'Text is encoded as UTF-8. Decoding accepts standard and URL-safe Base64, with or without padding.' }} />
      ) : (
        <Panel title="File to Base64" actions={<FileButton label="Choose file" onFile={onFile} />}>
          {!file ? <Empty>Choose a file. It is read locally and never uploaded.</Empty> : (
            <div className="flex flex-col gap-2">
              <p className="text-sm"><b>{file.name}</b> · {fmtBytes(file.size)} · {file.type || 'unknown type'} → {fmtBytes(file.b64.length)} Base64</p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} className="accent-[var(--primary)]" />URL-safe (re-choose file to apply)</label>
              <Textarea readOnly aria-label="Base64 output" value={file.b64.length > 200000 ? file.b64.slice(0, 200000) + '…(truncated in preview)' : file.b64} rows={10} className="w-full" />
              <div className="flex gap-2"><CopyButton text={file.b64} label="Copy Base64" /><CopyButton text={`data:${file.type || 'application/octet-stream'};base64,${file.b64}`} label="Copy data URI" /><DownloadButton text={file.b64} filename={`${file.name}.b64.txt`} /></div>
            </div>)}
        </Panel>
      )}
    </div>
  )
}
