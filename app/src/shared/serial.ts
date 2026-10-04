// §3.7 Serial protocol — Abel's Arduino sketch ↔ Ansh's serial reader.
// 115200 baud, newline-terminated ASCII lines. Unparseable lines are ignored.

export const SERIAL_BAUD = 115200
export const SERIAL_HELLO = 'HELLO:zoomies:1'
export const JOYSTICK_MAX = 1023

export type ArduinoMessage =
  | { kind: 'hello'; version: number }
  | { kind: 'joystick'; x: number; y: number }
  | { kind: 'button'; down: boolean }
  | { kind: 'touch'; down: boolean }

export type BuzzerPreset = 'squeak' | 'chirp'

export type AppToArduino =
  { kind: 'tone'; freqHz: number; ms: number } | { kind: 'preset'; name: BuzzerPreset }

function int(s: string): number | null {
  if (!/^\d+$/.test(s)) return null
  return Number(s)
}

function bool01(s: string): boolean | null {
  return s === '1' ? true : s === '0' ? false : null
}

/** Parse one line from the Arduino. Returns null for anything that doesn't match the protocol. */
export function parseArduinoLine(raw: string): ArduinoMessage | null {
  const line = raw.trim()
  const hello = /^HELLO:zoomies:(\d+)$/.exec(line)
  if (hello) return { kind: 'hello', version: Number(hello[1]) }

  const sep = line.indexOf(':')
  if (sep < 0) return null
  const key = line.slice(0, sep)
  const value = line.slice(sep + 1)

  if (key === 'J') {
    const [xs, ys, extra] = value.split(',')
    if (extra !== undefined || xs === undefined || ys === undefined) return null
    const x = int(xs)
    const y = int(ys)
    if (x === null || y === null || x > JOYSTICK_MAX || y > JOYSTICK_MAX) return null
    return { kind: 'joystick', x, y }
  }
  if (key === 'B' || key === 'T') {
    const down = bool01(value)
    if (down === null) return null
    return key === 'B' ? { kind: 'button', down } : { kind: 'touch', down }
  }
  return null
}

/** Format one line for the Arduino (newline included). */
export function formatAppMessage(msg: AppToArduino): string {
  if (msg.kind === 'tone') return `Z:${Math.round(msg.freqHz)},${Math.round(msg.ms)}\n`
  return `S:${msg.name}\n`
}
