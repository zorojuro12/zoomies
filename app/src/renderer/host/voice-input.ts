// Voice input (P3 serial, phase D3): the microphone, ONLY while push-to-talk is held (privacy rule).
// start() opens the mic and records, stop() closes it and hands over one clip. A tap shorter than
// `minMs` is not speech and is dropped; a stuck button stops itself after `maxMs`. A missing or
// blocked mic is reported, never thrown. The stream and recorder are injected, so it is all tested
// with fakes; `createBrowserVoiceInput` wires the real getUserMedia / MediaRecorder.
export const VOICE = { minMs: 400, maxMs: 10000 }

export interface StreamLike {
  stop(): void
  /** The real MediaStream (only the browser recorder factory looks at it). */
  raw?: unknown
}
export interface RecorderLike {
  state: string
  mimeType: string
  ondataavailable:
    ((e: { data: { size: number; arrayBuffer(): Promise<ArrayBuffer> } }) => void) | null
  onstop: (() => void) | null
  start(): void
  stop(): void
}
export interface VoiceInputDeps {
  getStream(): Promise<StreamLike>
  makeRecorder(stream: StreamLike): RecorderLike
  onClip(bytes: Uint8Array, mime: string): void
  onError(message: string): void
}

interface Session {
  stream: StreamLike
  rec: RecorderLike
  chunks: { size: number; arrayBuffer(): Promise<ArrayBuffer> }[]
  startedAt: number
  timer: ReturnType<typeof setTimeout>
}

export class VoiceInput {
  private attempt = 0
  private opening = false
  private session: Session | null = null

  constructor(private readonly deps: VoiceInputDeps) {}

  get recording(): boolean {
    return this.session !== null
  }

  /** The button went down. */
  start(): void {
    if (this.opening || this.session) return
    this.opening = true
    const mine = ++this.attempt
    this.deps
      .getStream()
      .then((stream) => {
        if (mine !== this.attempt) {
          stream.stop() // released before the mic was ready: close it again at once
          return
        }
        this.opening = false
        const rec = this.deps.makeRecorder(stream)
        const s: Session = {
          stream,
          rec,
          chunks: [],
          startedAt: Date.now(),
          timer: setTimeout(() => this.stop(), VOICE.maxMs)
        }
        rec.ondataavailable = (e): void => {
          if (e.data.size > 0) s.chunks.push(e.data)
        }
        rec.onstop = (): void => void this.finish(s)
        this.session = s
        rec.start()
      })
      .catch((e: unknown) => {
        if (mine !== this.attempt) return
        this.opening = false
        this.deps.onError(`microphone unavailable: ${String(e)}`)
      })
  }

  /** The button came up (or the safety cap hit). */
  stop(): void {
    if (this.opening) {
      this.opening = false
      this.attempt++ // cancels the pending open
      return
    }
    const s = this.session
    if (!s) return
    this.session = null
    clearTimeout(s.timer)
    try {
      s.rec.stop() // fires onstop -> finish
    } catch {
      s.stream.stop()
    }
  }

  private async finish(s: Session): Promise<void> {
    s.stream.stop() // mic off
    if (Date.now() - s.startedAt < VOICE.minMs) return // a tap, not speech
    try {
      const parts = await Promise.all(s.chunks.map((c) => c.arrayBuffer()))
      const total = parts.reduce((n, p) => n + p.byteLength, 0)
      const bytes = new Uint8Array(total)
      let at = 0
      for (const p of parts) {
        bytes.set(new Uint8Array(p), at)
        at += p.byteLength
      }
      if (bytes.length > 0) this.deps.onClip(bytes, s.rec.mimeType || 'audio/webm')
    } catch (e) {
      this.deps.onError(`could not read the recording: ${String(e)}`)
    }
  }
}

/** The real thing: the browser's microphone and MediaRecorder. */
export function createBrowserVoiceInput(
  onClip: (bytes: Uint8Array, mime: string) => void,
  onError: (message: string) => void
): VoiceInput {
  return new VoiceInput({
    getStream: async () => {
      const raw = await navigator.mediaDevices.getUserMedia({ audio: true })
      return { raw, stop: () => raw.getTracks().forEach((t) => t.stop()) }
    },
    makeRecorder: (stream) =>
      new MediaRecorder(stream.raw as MediaStream) as unknown as RecorderLike,
    onClip,
    onError
  })
}
