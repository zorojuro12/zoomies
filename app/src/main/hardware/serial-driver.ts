// The real serial driver: a thin wrapper over the `serialport` package, loaded lazily so the app still
// starts (with the controller simply absent) if the native module is not installed. It has no logic
// of its own worth testing; everything smart lives in serial-reader.ts, tested with fake drivers.
import type { PortInfo, SerialConnection, SerialDriver } from './serial-reader'

// Only the bits of serialport we use, so this file needs no type package.
interface RawPort {
  on(event: 'data', cb: (chunk: Uint8Array) => void): void
  on(event: 'close', cb: () => void): void
  on(event: 'error', cb: (e: Error) => void): void
  write(text: string): void
  close(cb?: () => void): void
  isOpen: boolean
}
interface SerialPortModule {
  SerialPort: {
    new (opts: { path: string; baudRate: number; autoOpen: boolean }): RawPort & {
      open(cb: (e: Error | null) => void): void
    }
    list(): Promise<PortInfo[]>
  }
}

const MODULE = 'serialport' // a variable, so typecheck passes before `npm install` has fetched it

export function createSerialDriver(log: (msg: string) => void): SerialDriver {
  let loaded: Promise<SerialPortModule | null> | null = null
  const load = (): Promise<SerialPortModule | null> => {
    loaded ??= (import(MODULE) as Promise<SerialPortModule>).catch((e: unknown) => {
      log(`serialport not available, controller disabled: ${String(e)}`)
      return null
    })
    return loaded
  }
  return {
    async list(): Promise<PortInfo[]> {
      const m = await load()
      return m ? m.SerialPort.list() : []
    },
    async open(path: string, baud: number): Promise<SerialConnection> {
      const m = await load()
      if (!m) throw new Error('serialport not installed')
      const port = new m.SerialPort({ path, baudRate: baud, autoOpen: false })
      await new Promise<void>((resolve, reject) => port.open((e) => (e ? reject(e) : resolve())))
      return {
        onData: (cb): void => port.on('data', (c) => cb(c)),
        onClose: (cb): void => port.on('close', cb),
        onError: (cb): void => port.on('error', cb),
        write: (text): void => port.write(text),
        close: (): void => {
          if (port.isOpen) port.close()
        }
      }
    }
  }
}
