// Serial reader (P3 serial, phase B): finds the board, reads it, turns it into InputEvents, and
// survives unplugging. Everything is fake here: ports, connections and the clock.
import { describe, expect, it } from 'vitest'
import type { InputEvent } from '@shared/input'
import {
  SerialReader,
  type PortInfo,
  type SerialConnection,
  type SerialDriver
} from './serial-reader'

class FakeConn implements SerialConnection {
  data: (c: string | Uint8Array) => void = () => {}
  closeCb: () => void = () => {}
  errCb: (e: Error) => void = () => {}
  written: string[] = []
  closed = false
  onData(cb: (c: string | Uint8Array) => void): void {
    this.data = cb
  }
  onClose(cb: () => void): void {
    this.closeCb = cb
  }
  onError(cb: (e: Error) => void): void {
    this.errCb = cb
  }
  write(s: string): void {
    this.written.push(s)
  }
  close(): void {
    this.closed = true
  }
  say(s: string | Uint8Array): void {
    this.data(s)
  }
}

class FakeDriver implements SerialDriver {
  ports: PortInfo[] = []
  failList = false
  failOpen = new Set<string>()
  conns = new Map<string, FakeConn[]>()
  opened: string[] = []
  async list(): Promise<PortInfo[]> {
    if (this.failList) throw new Error('list failed')
    return this.ports
  }
  async open(path: string): Promise<SerialConnection> {
    this.opened.push(path)
    if (this.failOpen.has(path)) throw new Error('busy')
    const c = new FakeConn()
    this.conns.set(path, [...(this.conns.get(path) ?? []), c])
    return c
  }
  last(path: string): FakeConn {
    const l = this.conns.get(path) ?? []
    return l[l.length - 1]
  }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

function setup(ports: PortInfo[] = [{ path: 'COM3', vendorId: '2341' }]): {
  d: FakeDriver
  r: SerialReader
  events: InputEvent[]
  status: { connected: boolean; port: string | null }[]
  at: (ms: number) => Promise<void>
  clock: { t: number }
} {
  const d = new FakeDriver()
  d.ports = ports
  const clock = { t: 1000 }
  const events: InputEvent[] = []
  const status: { connected: boolean; port: string | null }[] = []
  const r = new SerialReader({
    driver: d,
    clock: () => clock.t,
    emit: (e) => events.push(e),
    onStatus: (s) => status.push(s),
    log: () => {}
  })
  // advance the fake clock to t, ticking every 50 ms like the real timer does
  const at = async (ms: number): Promise<void> => {
    while (clock.t < ms) {
      clock.t = Math.min(ms, clock.t + 50)
      r.tick()
      await flush()
    }
  }
  return { d, r, events, status, at, clock }
}

async function connect(s: ReturnType<typeof setup>, path = 'COM3'): Promise<FakeConn> {
  s.r.tick()
  await flush()
  s.d.last(path).say('HELLO:zoomies:1\n')
  await flush()
  return s.d.last(path)
}

describe('finding the board', () => {
  it('opens the port, and on HELLO it is connected', async () => {
    const s = setup()
    await connect(s)
    expect(s.r.status).toEqual({ connected: true, port: 'COM3' })
    expect(s.status.at(-1)).toEqual({ connected: true, port: 'COM3' })
  })
  it('is not connected before the board says HELLO', async () => {
    const s = setup()
    s.r.tick()
    await flush()
    expect(s.r.status.connected).toBe(false)
  })
  it('only the port that says HELLO is claimed; the others are closed', async () => {
    const s = setup([{ path: 'COM1' }, { path: 'COM4', vendorId: '2341' }, { path: 'COM5' }])
    s.r.tick()
    await flush()
    expect(s.d.opened[0]).toBe('COM4') // Arduino-looking first
    s.d.last('COM4').say('J:1,2\n') // chatter that is not HELLO does not claim it
    await flush()
    expect(s.r.status.connected).toBe(false)
    await s.at(1000 + 3100) // probe times out -> next port
    s.d.last('COM1').say('hello there\n')
    await s.at(1000 + 6300)
    s.d.last('COM5').say('HELLO:zoomies:1\n')
    await flush()
    expect(s.r.status).toEqual({ connected: true, port: 'COM5' })
    expect(s.d.last('COM4').closed).toBe(true)
    expect(s.d.last('COM1').closed).toBe(true)
    expect(s.d.last('COM5').closed).toBe(false)
  })
  it('a HELLO for another protocol version is not claimed', async () => {
    const s = setup()
    s.r.tick()
    await flush()
    s.d.last('COM3').say('HELLO:zoomies:2\n')
    await flush()
    expect(s.r.status.connected).toBe(false)
  })
  it('a port that will not open is skipped and the next one is tried', async () => {
    const s = setup([{ path: 'COM1' }, { path: 'COM2' }])
    s.d.failOpen.add('COM1')
    s.r.tick()
    await flush()
    s.d.last('COM2').say('HELLO:zoomies:1\n')
    await flush()
    expect(s.r.status.port).toBe('COM2')
  })
  it('no ports at all: stays disconnected and tries again later', async () => {
    const s = setup([])
    await s.at(1000 + 500)
    s.d.ports = [{ path: 'COM3' }]
    await s.at(1000 + 6000)
    expect(s.d.opened).toContain('COM3')
  })
  it('listing ports fails: no crash, tries again later', async () => {
    const s = setup()
    s.d.failList = true
    s.r.tick()
    await flush()
    s.d.failList = false
    await s.at(1000 + 6000)
    expect(s.d.opened).toContain('COM3')
  })
  it('does not open the same port twice at once while still probing', async () => {
    const s = setup()
    await s.at(1000 + 2000)
    expect(s.d.opened).toEqual(['COM3'])
  })
})

describe('reading', () => {
  it('turns messages into InputEvents (touch -> pet) and repeated HELLO changes nothing', async () => {
    const s = setup()
    const c = await connect(s)
    c.say('HELLO:zoomies:1\nT:1\n')
    await flush()
    expect(s.events.filter((e) => e.kind === 'pet')).toHaveLength(1)
    expect(s.status).toHaveLength(1)
  })
  it('lines cut in pieces, with \\r\\n, still work', async () => {
    const s = setup()
    const c = await connect(s)
    c.say('T')
    c.say(':1\r')
    c.say('\n')
    await flush()
    expect(s.events.some((e) => e.kind === 'pet')).toBe(true)
  })
  it('junk lines are ignored', async () => {
    const s = setup()
    const c = await connect(s)
    c.say('garbage\nJ:9999,1\nX:1\n')
    await flush()
    expect(s.events).toEqual([])
    expect(s.r.status.connected).toBe(true)
  })
  it('a held button becomes push-to-talk via the 50 ms tick', async () => {
    const s = setup()
    const c = await connect(s)
    c.say('B:1\n')
    await s.at(s.clock.t + 600)
    c.say('HELLO:zoomies:1\n')
    expect(s.events).toContainEqual({ kind: 'pushToTalk', state: 'start' })
  })
})

describe('losing the board', () => {
  it('6 s of silence is a dead connection: closes it, reports it, and rescans', async () => {
    const s = setup()
    const c = await connect(s)
    await s.at(s.clock.t + 5900)
    expect(s.r.status.connected).toBe(true)
    await s.at(s.clock.t + 300)
    expect(s.r.status.connected).toBe(false)
    expect(c.closed).toBe(true)
    await s.at(s.clock.t + 6000)
    expect(s.d.conns.get('COM3')!.length).toBeGreaterThan(1)
  })
  it('the board talking (HELLO every 2 s) keeps it alive forever', async () => {
    const s = setup()
    const c = await connect(s)
    for (let i = 0; i < 100; i++) {
      await s.at(s.clock.t + 2000)
      c.say('HELLO:zoomies:1\n')
    }
    expect(s.r.status.connected).toBe(true)
  })
  it('unplugging (close event) ends push-to-talk, reports disconnected, and reconnects on replug', async () => {
    const s = setup()
    const c = await connect(s)
    c.say('B:1\n')
    await s.at(s.clock.t + 600)
    c.closeCb()
    await flush()
    expect(s.events).toContainEqual({ kind: 'pushToTalk', state: 'stop' })
    expect(s.r.status.connected).toBe(false)
    expect(s.status.at(-1)).toEqual({ connected: false, port: null })
    await s.at(s.clock.t + 2100)
    s.d.last('COM3').say('HELLO:zoomies:1\n')
    await flush()
    expect(s.r.status.connected).toBe(true)
  })
  it('an error event is treated like an unplug', async () => {
    const s = setup()
    const c = await connect(s)
    c.errCb(new Error('device lost'))
    await flush()
    expect(s.r.status.connected).toBe(false)
  })
  it('old connection events after a reconnect are ignored', async () => {
    const s = setup()
    const c1 = await connect(s)
    c1.closeCb()
    await s.at(s.clock.t + 2100)
    const c2 = s.d.last('COM3')
    c2.say('HELLO:zoomies:1\n')
    await flush()
    c1.closeCb() // late echo from the dead one
    c1.say('T:1\n')
    await flush()
    expect(s.r.status.connected).toBe(true)
    expect(s.events.filter((e) => e.kind === 'pet')).toHaveLength(0)
  })
  it('status is reported once per change, not every tick', async () => {
    const s = setup()
    await connect(s)
    await s.at(s.clock.t + 1500)
    expect(s.status).toHaveLength(1)
  })
  it('30 unplug/replug cycles end connected with no leaked open ports', async () => {
    const s = setup()
    await connect(s)
    for (let i = 0; i < 30; i++) {
      s.d.last('COM3').closeCb()
      await flush()
      await s.at(s.clock.t + 2100)
      s.d.last('COM3').say('HELLO:zoomies:1\n')
      await flush()
      expect(s.r.status.connected).toBe(true)
    }
    const open = (s.d.conns.get('COM3') ?? []).filter((c) => !c.closed)
    expect(open.length).toBeLessThanOrEqual(1 + 30) // closeCb conns are gone already
    expect(s.d.last('COM3').closed).toBe(false)
  })
})

describe('sending to the board', () => {
  it('writes a buzzer preset as a protocol line', async () => {
    const s = setup()
    const c = await connect(s)
    s.r.send({ kind: 'preset', name: 'squeak' })
    s.r.send({ kind: 'tone', freqHz: 880, ms: 120 })
    expect(c.written).toEqual(['S:squeak\n', 'Z:880,120\n'])
  })
  it('is silently dropped when not connected', () => {
    const s = setup()
    expect(() => s.r.send({ kind: 'preset', name: 'chirp' })).not.toThrow()
  })
  it('a write that throws does not crash the app', async () => {
    const s = setup()
    const c = await connect(s)
    c.write = (): void => {
      throw new Error('EIO')
    }
    expect(() => s.r.send({ kind: 'preset', name: 'chirp' })).not.toThrow()
  })
})

describe('stop', () => {
  it('closes the port, ends push-to-talk, and stops scanning', async () => {
    const s = setup()
    const c = await connect(s)
    c.say('B:1\n')
    await s.at(s.clock.t + 600)
    s.r.stop()
    expect(c.closed).toBe(true)
    expect(s.events).toContainEqual({ kind: 'pushToTalk', state: 'stop' })
    const n = s.d.opened.length
    await s.at(s.clock.t + 20000)
    expect(s.d.opened.length).toBe(n)
  })
})

describe('fuzz', () => {
  it('random junk, closes and silences never throw and never leave status inconsistent', async () => {
    let seed = 5
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const s = setup([{ path: 'COM3', vendorId: '2341' }, { path: 'COM4' }])
    const msgs = [
      'HELLO:zoomies:1\n',
      'J:500,500\n',
      'J:900,100\n',
      'B:1\n',
      'B:0\n',
      'T:1\n',
      'T:0\n',
      'xx\n',
      '\r\n',
      'J:5'
    ]
    for (let i = 0; i < 3000; i++) {
      await s.at(s.clock.t + Math.floor(rand() * 400))
      const path = rand() < 0.5 ? 'COM3' : 'COM4'
      const c = s.d.last(path)
      if (c) {
        const x = rand()
        if (x < 0.7) c.say(msgs[Math.floor(rand() * msgs.length)])
        else if (x < 0.8) c.closeCb()
        else if (x < 0.85) c.errCb(new Error('x'))
      }
      expect(s.r.status.connected).toBe(s.r.status.port !== null)
    }
  })
})
