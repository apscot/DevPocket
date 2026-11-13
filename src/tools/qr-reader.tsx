import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { Button, CopyButton, Empty, FileButton, Notice, Panel } from '@/components/kit'

type Decoded = { text: string; src: string }
async function decodeImageData(d: ImageData) { const jsQR = (await import('jsqr')).default; return jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' }) }
export default function QrReader() {
  const [res, setRes] = useState<Decoded | null>(null); const [err, setErr] = useState(''); const [cam, setCam] = useState(false); const [preview, setPreview] = useState('')
  const video = useRef<HTMLVideoElement>(null); const stream = useRef<MediaStream | null>(null); const raf = useRef(0)
  const canCam = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext
  const fromFile = async (f: File) => {
    setErr(''); setRes(null)
    try {
      const bmp = await createImageBitmap(f); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height
      const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(bmp, 0, 0)
      const r = await decodeImageData(x.getImageData(0, 0, c.width, c.height))
      setPreview(URL.createObjectURL(f))
      if (r) setRes({ text: r.data, src: f.name }); else setErr('No QR code found in this image. Try a sharper, larger or better-lit picture.')
    } catch (e) { setErr(`Could not read the image: ${(e as Error).message}`) }
  }
  const stop = () => { cancelAnimationFrame(raf.current); stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setCam(false) }
  const start = async () => {
    setErr(''); setRes(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); stream.current = s; setCam(true)
      const v = video.current!; v.srcObject = s; await v.play()
      const c = document.createElement('canvas'); const x = c.getContext('2d', { willReadFrequently: true })!
      const tick = async () => {
        if (v.readyState >= 2 && v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; x.drawImage(v, 0, 0); const r = await decodeImageData(x.getImageData(0, 0, c.width, c.height)); if (r) { setRes({ text: r.data, src: 'camera' }); stop(); return } }
        raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    } catch (e) { setErr(`Camera unavailable: ${(e as Error).message}`); stop() }
  }
  useEffect(() => () => stop(), [])
  const isUrl = res && /^https?:\/\//i.test(res.text)
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Source" actions={<><FileButton label="Choose image" accept="image/*" onFile={fromFile} />{canCam && (cam ? <Button onClick={stop}><CameraOff size={14} />Stop</Button> : <Button onClick={start}><Camera size={14} />Camera</Button>)}</>}>
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) fromFile(f) }} className="flex min-h-[240px] items-center justify-center rounded-md border-2 border-dashed p-3">
          <video ref={video} muted playsInline className={cam ? 'max-h-72 rounded' : 'hidden'} />
          {!cam && (preview ? <img src={preview} alt="Uploaded" className="max-h-72 rounded" /> : <p className="text-center text-sm text-muted-foreground">Drop an image here or choose a file.<br />Decoding happens locally — images are never uploaded.</p>)}
        </div>
        {!canCam && <p className="mt-2 text-xs text-muted-foreground">Camera scanning needs HTTPS (or localhost) and browser permission; it is unavailable in this context. Image upload still works.</p>}
      </Panel>
      <div className="flex min-w-0 flex-col gap-3">
        {err && <Notice kind="error">{err}</Notice>}
        {!res && !err && <Empty>Upload or drop a QR code image to decode it.</Empty>}
        {res && <Panel title="Decoded content" actions={<CopyButton text={res.text} />}><pre className="mono whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3 text-sm" data-testid="qr-result">{res.text}</pre><p className="mt-2 text-xs text-muted-foreground">Source: {res.src}</p>{isUrl && <Notice kind="warn" className="mt-2">This QR code contains a link. Inspect it before opening — it is shown as text and not opened automatically.</Notice>}</Panel>}
      </div>
    </div>
  )
}
