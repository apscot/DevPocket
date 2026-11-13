import { parseCsv, detectDelimiter } from '@/lib/csv'
self.onmessage = (e: MessageEvent<{ text: string; delimiter: string }>) => {
  try {
    const d = e.data.delimiter === 'auto' ? detectDelimiter(e.data.text) : e.data.delimiter
    self.postMessage({ ok: true, rows: parseCsv(e.data.text, d), delimiter: d })
  } catch (err) { self.postMessage({ ok: false, error: (err as Error).message }) }
}
