// Line splitter (P3 serial, phase B): glues the Arduino's byte chunks back into whole text lines.
// A chunk can end anywhere, so a half line is kept until its newline arrives. A line longer than
// `maxLen` is junk (wrong or stuck device): it is dropped up to its newline, never buffered.
export const MAX_LINE_LEN = 64

export class LineSplitter {
  private buf = ''
  private discarding = false

  constructor(private readonly maxLen: number = MAX_LINE_LEN) {}

  /** Characters held while waiting for a newline. */
  get pendingLength(): number {
    return this.buf.length
  }

  push(chunk: string | Uint8Array, onLine: (line: string) => void): void {
    const text = typeof chunk === 'string' ? chunk : String.fromCharCode(...chunk)
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === '\n') {
        if (!this.discarding && this.buf.length > 0) onLine(this.buf)
        this.buf = ''
        this.discarding = false
      } else if (ch === '\r' || this.discarding) {
        continue
      } else if (this.buf.length >= this.maxLen) {
        this.buf = ''
        this.discarding = true
      } else {
        this.buf += ch
      }
    }
  }

  reset(): void {
    this.buf = ''
    this.discarding = false
  }
}
