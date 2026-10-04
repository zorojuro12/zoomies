import { describe, expect, it } from 'vitest'
import { formatAppMessage, parseArduinoLine } from '@shared/serial'

describe('parseArduinoLine', () => {
  it('parses the hello line', () => {
    expect(parseArduinoLine('HELLO:zoomies:1')).toEqual({ kind: 'hello', version: 1 })
  })

  it('parses joystick, button and touch lines (tolerating CRLF)', () => {
    expect(parseArduinoLine('J:512,300\r')).toEqual({ kind: 'joystick', x: 512, y: 300 })
    expect(parseArduinoLine('B:1')).toEqual({ kind: 'button', down: true })
    expect(parseArduinoLine('T:0')).toEqual({ kind: 'touch', down: false })
  })

  it.each(['', 'garbage', 'J:512', 'J:1024,0', 'J:-1,5', 'J:1,2,3', 'B:2', 'X:1', 'HELLO:other:1'])(
    'ignores %j',
    (line) => {
      expect(parseArduinoLine(line)).toBeNull()
    }
  )
})

describe('formatAppMessage', () => {
  it('formats tones and presets as newline-terminated lines', () => {
    expect(formatAppMessage({ kind: 'tone', freqHz: 880.4, ms: 120 })).toBe('Z:880,120\n')
    expect(formatAppMessage({ kind: 'preset', name: 'squeak' })).toBe('S:squeak\n')
  })
})
