// Rolling frame-time / work-time stats for the FPS overlay (Task 2 of a-p1-overlay.md).
// No allocation in `add`: ring buffers and one scratch array are preallocated at construction.
export class FrameStats {
  private readonly capacity: number
  private readonly frameBuf: Float64Array
  private readonly workBuf: Float64Array
  private readonly scratch: Float64Array
  private writeIndex = 0
  private sampleCount = 0

  constructor(capacity = 120) {
    this.capacity = capacity
    this.frameBuf = new Float64Array(capacity)
    this.workBuf = new Float64Array(capacity)
    this.scratch = new Float64Array(capacity)
  }

  add(frameMs: number, workMs: number): void {
    this.frameBuf[this.writeIndex] = frameMs
    this.workBuf[this.writeIndex] = workMs
    this.writeIndex = (this.writeIndex + 1) % this.capacity
    this.sampleCount = Math.min(this.sampleCount + 1, this.capacity)
  }

  count(): number {
    return this.sampleCount
  }

  private avg(buf: Float64Array): number {
    const n = this.sampleCount
    if (n === 0) return 0
    let sum = 0
    for (let i = 0; i < n; i++) sum += buf[i]
    return sum / n
  }

  private sortedScratch(buf: Float64Array): Float64Array {
    const n = this.sampleCount
    for (let i = 0; i < n; i++) this.scratch[i] = buf[i]
    const view = this.scratch.subarray(0, n)
    view.sort()
    return view
  }

  frameAvg(): number {
    return this.avg(this.frameBuf)
  }

  frameP95(): number {
    const n = this.sampleCount
    if (n === 0) return 0
    return this.sortedScratch(this.frameBuf)[Math.floor(0.95 * n)]
  }

  workAvg(): number {
    return this.avg(this.workBuf)
  }

  workP95(): number {
    const n = this.sampleCount
    if (n === 0) return 0
    return this.sortedScratch(this.workBuf)[Math.floor(0.95 * n)]
  }

  workMax(): number {
    const n = this.sampleCount
    if (n === 0) return 0
    return this.sortedScratch(this.workBuf)[n - 1]
  }

  fps(): number {
    const avg = this.frameAvg()
    return avg === 0 ? 0 : 1000 / avg
  }
}
