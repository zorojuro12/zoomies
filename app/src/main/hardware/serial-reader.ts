// Serial reader (P3 serial, phase B): finds the Zoomies board among the computer's serial ports,
// reads its lines into the ControllerMapper (which makes InputEvents), notices when it goes quiet or
// is unplugged, and reconnects. It never throws: a missing or flaky board must not hurt the app
// ("the demo must survive a loose wire"). The real port library sits behind `SerialDriver`, and the
// clock is passed in, so every behaviour here is tested with fakes, no hardware.
//
//   find:  list ports, Arduino-looking ones first; open one at a time and wait up to `probeMs` for
//          `HELLO:zoomies:1`. Only the port that says it is claimed, the others are closed.
//   alive: the board sends HELLO every 2 s, so `silenceMs` (6 s) with no line = dead; close, rescan.
//   gone:  a close or error event, or silence: reset the mapper (ends push-to-talk), report it.
import type { InputEvent } from '@shared/input'
import {
  SERIAL_BAUD,
  SERIAL_HELLO,
  formatAppMessage,
  parseArduinoLine,
  type AppToArduino
} from '@shared/serial'
import { ControllerMapper } from './controller-mapper'
import { LineSplitter } from './line-splitter'

export interface PortInfo {
  path: string
  manufacturer?: string
  vendorId?: string
  productId?: string
}

export interface SerialConnection {
  onData(cb: (chunk: string | Uint8Array) => void): void
  onClose(cb: () => void): void
  onError(cb: (e: Error) => void): void
  write(text: string): void
  close(): void
}

export interface SerialDriver {
  list(): Promise<PortInfo[]>
  open(path: string, baud: number): Promise<SerialConnection>
}

export interface SerialStatus {
  connected: boolean
  port: string | null
}

export const READER = {
  tickMs: 50,
  silenceMs: 6000,
  probeMs: 3000,
  retryMinMs: 2000,
  retryMaxMs: 5000
}

// USB vendors that make Arduino boards and their usual serial chips (Arduino, clones, CH340, FTDI, CP210x).
const ARDUINO_VENDORS = new Set(['2341', '2a03', '1a86', '0403', '10c4'])
const ARDUINO_NAME = /arduino|wch|ftdi|silicon lab|ch340/i

function looksLikeArduino(p: PortInfo): boolean {
  if (p.vendorId && ARDUINO_VENDORS.has(p.vendorId.toLowerCase())) return true
  return !!p.manufacturer && ARDUINO_NAME.test(p.manufacturer)
}

/** Arduino-looking ports first, otherwise the order the system gave. */
export function orderPorts(ports: PortInfo[]): PortInfo[] {
  return [...ports.filter(looksLikeArduino), ...ports.filter((p) => !looksLikeArduino(p))]
}

export interface ReaderOptions {
  driver: SerialDriver
  emit: (e: InputEvent) => void
  onStatus?: (s: SerialStatus) => void
  clock?: () => number
  mapper?: ControllerMapper
  log?: (msg: string) => void
}

type State = 'idle' | 'listing' | 'opening' | 'probing' | 'connected' | 'stopped'

interface Link {
  conn: SerialConnection
  path: string
  splitter: LineSplitter
}

export class SerialReader {
  private readonly driver: SerialDriver
  private readonly emit: (e: InputEvent) => void
  private readonly onStatus: (s: SerialStatus) => void
  private readonly clock: () => number
  private readonly mapper: ControllerMapper
  private readonly log: (msg: string) => void

  private state: State = 'idle'
  private candidates: PortInfo[] = []
  private link: Link | null = null
  private nextScanAt = 0
  private retryMs: number = READER.retryMinMs
  private probeStartedAt = 0
  private lastLineAt = 0
  private reported: SerialStatus = { connected: false, port: null }
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(opts: ReaderOptions) {
    this.driver = opts.driver
    this.emit = opts.emit
    this.onStatus = opts.onStatus ?? ((): void => {})
    this.clock = opts.clock ?? ((): number => Date.now())
    this.mapper = opts.mapper ?? new ControllerMapper()
    this.log = opts.log ?? ((m: string): void => console.log(`[serial] ${m}`))
  }

  get status(): SerialStatus {
    return this.reported
  }

  /** Run the reader on a real timer. */
  start(): void {
    if (this.timer || this.state === 'stopped') return
    this.timer = setInterval(() => this.tick(), READER.tickMs)
    this.timer.unref?.()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.dropLink()
    this.mapper.reset(this.emit)
    this.state = 'stopped'
    this.report(false, null)
  }

  /** Time passing (every ~50 ms): holds, probe timeouts, the silence watchdog, rescans. */
  tick(): void {
    const now = this.clock()
    if (this.state === 'idle') {
      if (now >= this.nextScanAt) {
        this.state = 'listing'
        void this.scan()
      }
    } else if (this.state === 'probing') {
      if (now - this.probeStartedAt >= READER.probeMs) {
        this.dropLink()
        void this.tryNext()
      }
    } else if (this.state === 'connected') {
      this.mapper.tick(now, this.emit)
      if (now - this.lastLineAt >= READER.silenceMs) {
        this.log('board went quiet, reconnecting')
        this.lose()
      }
    }
  }

  /** Send a line to the board (buzzer). Dropped when not connected. */
  send(msg: AppToArduino): void {
    if (this.state !== 'connected' || !this.link) return
    try {
      this.link.conn.write(formatAppMessage(msg))
    } catch (e) {
      this.log(`write failed: ${String(e)}`)
    }
  }

  private async scan(): Promise<void> {
    try {
      this.candidates = orderPorts(await this.driver.list())
    } catch (e) {
      this.log(`could not list ports: ${String(e)}`)
      this.candidates = []
    }
    if (this.state !== 'listing') return
    await this.tryNext()
  }

  private async tryNext(): Promise<void> {
    if (this.state === 'stopped') return
    const next = this.candidates.shift()
    if (!next) {
      this.giveUpScan()
      return
    }
    this.state = 'opening'
    let conn: SerialConnection
    try {
      conn = await this.driver.open(next.path, SERIAL_BAUD)
    } catch {
      if (this.state === 'opening') await this.tryNext()
      return
    }
    if (this.state !== 'opening') {
      conn.close() // stopped while opening
      return
    }
    const link: Link = { conn, path: next.path, splitter: new LineSplitter() }
    this.link = link
    this.state = 'probing'
    this.probeStartedAt = this.clock()
    conn.onData((chunk) => {
      if (this.link === link) link.splitter.push(chunk, (line) => this.onLine(line))
    })
    conn.onClose(() => this.linkGone(link))
    conn.onError(() => this.linkGone(link))
  }

  private onLine(line: string): void {
    const now = this.clock()
    if (this.state === 'probing') {
      if (line.trim() !== SERIAL_HELLO) return
      this.state = 'connected'
      this.candidates = []
      this.lastLineAt = now
      this.retryMs = READER.retryMinMs
      this.log(`connected on ${this.link?.path}`)
      this.report(true, this.link?.path ?? null)
      return
    }
    if (this.state !== 'connected') return
    this.lastLineAt = now
    const msg = parseArduinoLine(line)
    if (msg) this.mapper.feed(msg, now, this.emit)
  }

  private linkGone(link: Link): void {
    if (this.link !== link) return // an old connection echoing
    if (this.state === 'connected') this.lose()
    else if (this.state === 'probing') {
      this.dropLink()
      void this.tryNext()
    }
  }

  private lose(): void {
    this.dropLink()
    this.mapper.reset(this.emit)
    this.report(false, null)
    this.giveUpScan()
  }

  private giveUpScan(): void {
    this.state = 'idle'
    this.nextScanAt = this.clock() + this.retryMs
    this.retryMs = Math.min(READER.retryMaxMs, this.retryMs + 1000)
  }

  private dropLink(): void {
    const link = this.link
    this.link = null
    if (!link) return
    try {
      link.conn.close()
    } catch {
      // already gone
    }
  }

  private report(connected: boolean, port: string | null): void {
    if (this.reported.connected === connected && this.reported.port === port) return
    this.reported = { connected, port }
    this.onStatus(this.reported)
  }
}
