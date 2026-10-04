// Line splitter (P3 serial, phase B): the Arduino's bytes arrive in chunks that can cut a line anywhere
// ("J:3" then "40,610\nB:"). This glues them back into whole lines, copes with \r\n, and throws away
// junk that is far too long to be a message (a stuck or wrong device) instead of growing forever.
import { describe, expect, it } from 'vitest'
import { LineSplitter } from './line-splitter'

function run(chunks: (string | number[])[], maxLen?: number): string[] {
  const s = new LineSplitter(maxLen)
  const lines: string[] = []
  for (const c of chunks)
    s.push(typeof c === 'string' ? c : Uint8Array.from(c), (l) => lines.push(l))
  return lines
}

describe('whole lines', () => {
  it('one complete line', () => {
    expect(run(['J:340,610\n'])).toEqual(['J:340,610'])
  })
  it('several lines in one chunk', () => {
    expect(run(['B:1\nT:0\nJ:1,2\n'])).toEqual(['B:1', 'T:0', 'J:1,2'])
  })
  it('windows line endings (\\r\\n) and stray \\r are dropped', () => {
    expect(run(['HELLO:zoomies:1\r\nB:1\r\n'])).toEqual(['HELLO:zoomies:1', 'B:1'])
  })
  it('blank lines are skipped', () => {
    expect(run(['\n\nB:1\n\r\n'])).toEqual(['B:1'])
  })
})

describe('chunks that cut a line anywhere', () => {
  it('a line split in two', () => {
    expect(run(['J:3', '40,610\n'])).toEqual(['J:340,610'])
  })
  it('a line split into single characters', () => {
    expect(run('B:1\n'.split(''))).toEqual(['B:1'])
  })
  it('a chunk that ends mid-line keeps the rest for the next chunk', () => {
    expect(run(['B:1\nJ:5', '00,5', '00\nT:1\n'])).toEqual(['B:1', 'J:500,500', 'T:1'])
  })
  it('a \\r\\n split between the two characters', () => {
    expect(run(['B:1\r', '\nT:0\n'])).toEqual(['B:1', 'T:0'])
  })
  it('a half line with no newline yet is not delivered', () => {
    expect(run(['J:12'])).toEqual([])
  })
})

describe('bytes (what a real serial port gives)', () => {
  it('reads ASCII bytes', () => {
    expect(run([[66, 58, 49, 10]])).toEqual(['B:1'])
  })
  it('bytes cut anywhere work just like text', () => {
    expect(
      run([
        [74, 58],
        [49, 50, 51, 44],
        [52, 10]
      ])
    ).toEqual(['J:123,4'])
  })
  it('non-ASCII garbage bytes do not break the lines around them', () => {
    expect(run([[255, 254, 10, 66, 58, 49, 10]])).toHaveLength(2)
    expect(run([[255, 254, 10, 66, 58, 49, 10]])[1]).toBe('B:1')
  })
})

describe('junk that is too long', () => {
  it('a line over the limit is thrown away, and the next good line still comes through', () => {
    expect(run(['X'.repeat(100) + '\nB:1\n'], 64)).toEqual(['B:1'])
  })
  it('a long line arriving over many chunks is thrown away too, without holding it all in memory', () => {
    const s = new LineSplitter(16)
    const lines: string[] = []
    for (let i = 0; i < 1000; i++) s.push('Y'.repeat(50), (l) => lines.push(l))
    expect(lines).toEqual([])
    s.push('\nT:1\n', (l) => lines.push(l))
    expect(lines).toEqual(['T:1'])
    expect(s.pendingLength).toBeLessThanOrEqual(16)
  })
  it('a line exactly at the limit is kept', () => {
    expect(run(['A'.repeat(64) + '\n'], 64)).toEqual(['A'.repeat(64)])
    expect(run(['A'.repeat(65) + '\n'], 64)).toEqual([])
  })
})

describe('reset and misuse', () => {
  it('reset forgets a half line (a replugged board starts fresh)', () => {
    const s = new LineSplitter()
    const lines: string[] = []
    s.push('J:12', (l) => lines.push(l))
    s.reset()
    s.push('B:1\n', (l) => lines.push(l))
    expect(lines).toEqual(['B:1'])
  })
  it('an empty chunk does nothing', () => {
    expect(run(['', 'B:1\n', ''])).toEqual(['B:1'])
  })
  it('survives 20,000 random chunks of random bytes without throwing, and every line is short and clean', () => {
    let seed = 17
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const s = new LineSplitter(32)
    for (let i = 0; i < 20000; i++) {
      const n = Math.floor(rand() * 20)
      const bytes = Uint8Array.from({ length: n }, () =>
        rand() < 0.1 ? 10 : Math.floor(rand() * 256)
      )
      s.push(bytes, (l) => {
        expect(l.length).toBeLessThanOrEqual(32)
        expect(l.includes('\n')).toBe(false)
        expect(l.includes('\r')).toBe(false)
        expect(l.length).toBeGreaterThan(0)
      })
    }
  })
})
