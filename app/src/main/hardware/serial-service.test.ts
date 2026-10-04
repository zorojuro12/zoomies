// Serial service (P3 serial, phase C): glue between the reader and the app window. Fakes only.
import { describe, expect, it } from 'vitest'
import type { InputEvent } from '@shared/input'
import { mapperConfigFromEnv, startSerialService } from './serial-service'
import type { PortInfo, SerialConnection, SerialDriver } from './serial-reader'

class Conn implements SerialConnection {
  data: (c: string | Uint8Array) => void = () => {}
  written: string[] = []
  onData(cb: (c: string | Uint8Array) => void): void {
    this.data = cb
  }
  onClose(): void {
    // never closes in these tests
  }
  onError(): void {
    // never errors in these tests
  }
  write(s: string): void {
    this.written.push(s)
  }
  close(): void {
    // nothing to close
  }
}
class Driver implements SerialDriver {
  conn = new Conn()
  listed = 0
  async list(): Promise<PortInfo[]> {
    this.listed++
    return [{ path: 'COM3' }]
  }
  async open(): Promise<SerialConnection> {
    return this.conn
  }
}
const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

describe('mapperConfigFromEnv', () => {
  it('defaults to no flipping', () => {
    expect(mapperConfigFromEnv({})).toEqual({ invertX: false, invertY: false, swapXY: false })
  })
  it('reads the three flags (only "1" turns one on)', () => {
    expect(
      mapperConfigFromEnv({ ZOOMIES_INVERT_X: '1', ZOOMIES_INVERT_Y: '0', ZOOMIES_SWAP_XY: '1' })
    ).toEqual({ invertX: true, invertY: false, swapXY: true })
  })
})

describe('startSerialService', () => {
  it('ZOOMIES_SERIAL=0 does nothing at all', async () => {
    const d = new Driver()
    const svc = startSerialService({
      driver: d,
      env: { ZOOMIES_SERIAL: '0' },
      sendInput: () => {},
      sendStatus: () => {},
      autoTick: false
    })
    svc.reader?.tick()
    await flush()
    expect(d.listed).toBe(0)
    expect(() => svc.buzz('squeak')).not.toThrow()
    svc.stop()
  })
  it('forwards input events and status, and buzz() reaches the board', async () => {
    const d = new Driver()
    const inputs: InputEvent[] = []
    const statuses: unknown[] = []
    const svc = startSerialService({
      driver: d,
      env: {},
      sendInput: (e) => inputs.push(e),
      sendStatus: (s) => statuses.push(s),
      autoTick: false
    })
    expect(statuses).toEqual([{ connected: false, port: null }]) // renderer learns the starting state
    svc.reader!.tick()
    await flush()
    d.conn.data('HELLO:zoomies:1\nT:1\n')
    await flush()
    expect(statuses.at(-1)).toEqual({ connected: true, port: 'COM3' })
    expect(inputs).toContainEqual({ kind: 'pet', source: 'touch' })
    svc.buzz('chirp')
    expect(d.conn.written).toEqual(['S:chirp\n'])
    svc.stop()
  })
  it('the orientation flags reach the mapper (inverted X flips the aim direction)', async () => {
    const aim = async (env: Record<string, string>): Promise<number> => {
      const d = new Driver()
      const inputs: InputEvent[] = []
      const svc = startSerialService({
        driver: d,
        env,
        sendInput: (e) => inputs.push(e),
        sendStatus: () => {},
        autoTick: false
      })
      svc.reader!.tick()
      await flush()
      d.conn.data('HELLO:zoomies:1\nJ:512,512\nJ:100,512\n')
      await flush()
      const e = inputs.find((i) => i.kind === 'aim')
      svc.stop()
      return e && e.kind === 'aim' ? Math.cos(e.angle) : NaN
    }
    const normal = await aim({})
    const flipped = await aim({ ZOOMIES_INVERT_X: '1' })
    expect(Math.sign(normal)).toBe(-Math.sign(flipped))
  })
})
