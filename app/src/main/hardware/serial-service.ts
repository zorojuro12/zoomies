// Serial service (P3 serial, phase C): starts the serial reader for the app and hands its output to
// the window. The main process calls this once; it knows nothing about Electron (the callbacks are
// the only link), so it is tested with fakes. ZOOMIES_SERIAL=0 turns the whole thing off;
// ZOOMIES_INVERT_X / ZOOMIES_INVERT_Y / ZOOMIES_SWAP_XY (= 1) fix how the joystick is mounted.
import type { InputEvent } from '@shared/input'
import type { BuzzerPreset } from '@shared/serial'
import { ControllerMapper, type MapperConfig } from './controller-mapper'
import { SerialReader, type SerialDriver, type SerialStatus } from './serial-reader'

type Env = Record<string, string | undefined>

export function mapperConfigFromEnv(env: Env): MapperConfig {
  return {
    invertX: env.ZOOMIES_INVERT_X === '1',
    invertY: env.ZOOMIES_INVERT_Y === '1',
    swapXY: env.ZOOMIES_SWAP_XY === '1'
  }
}

export interface SerialServiceOptions {
  driver: SerialDriver
  env: Env
  sendInput: (e: InputEvent) => void
  sendStatus: (s: SerialStatus) => void
  /** Tests turn the real 50 ms timer off and call `reader.tick()` themselves. */
  autoTick?: boolean
  log?: (msg: string) => void
}

export interface SerialService {
  reader: SerialReader | null
  buzz(preset: BuzzerPreset): void
  stop(): void
}

export function startSerialService(opts: SerialServiceOptions): SerialService {
  if (opts.env.ZOOMIES_SERIAL === '0') return { reader: null, buzz: () => {}, stop: () => {} }
  const reader = new SerialReader({
    driver: opts.driver,
    emit: opts.sendInput,
    onStatus: opts.sendStatus,
    mapper: new ControllerMapper(mapperConfigFromEnv(opts.env)),
    log: opts.log
  })
  opts.sendStatus(reader.status)
  if (opts.autoTick !== false) reader.start()
  return {
    reader,
    buzz: (preset) => reader.send({ kind: 'preset', name: preset }),
    stop: () => reader.stop()
  }
}
