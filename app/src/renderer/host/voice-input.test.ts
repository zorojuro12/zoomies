// Voice input (P3 serial, phase D3): the microphone, ONLY while push-to-talk is held. Everything is fake
// (stream, recorder, clock), so the tests check the rules: mic off when not held, short taps ignored,
// the 10 s cap, and a missing/blocked mic never crashes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VoiceInput, VOICE, type RecorderLike, type StreamLike } from './voice-input'

class FakeRecorder implements RecorderLike {
  state: 'inactive' | 'recording' = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable:
    ((e: { data: { size: number; arrayBuffer(): Promise<ArrayBuffer> } }) => void) | null = null
  onstop: (() => void) | null = null
  start(): void {
    this.state = 'recording'
  }
  stop(): void {
    this.state = 'inactive'
    this.ondataavailable?.({
      data: { size: 3, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }
    })
    this.onstop?.()
  }
}
interface Rig {
  v: VoiceInput
  clips: { bytes: Uint8Array; mime: string }[]
  errors: string[]
  streams: { tracksStopped: number }[]
  recs: FakeRecorder[]
  deny: { on: boolean }
}
function rig(): Rig {
  const clips: Rig['clips'] = []
  const errors: string[] = []
  const streams: Rig['streams'] = []
  const recs: FakeRecorder[] = []
  const deny = { on: false }
  const v = new VoiceInput({
    getStream: async (): Promise<StreamLike> => {
      if (deny.on) throw new Error('NotAllowedError')
      const s = { tracksStopped: 0 }
      streams.push(s)
      return { stop: () => s.tracksStopped++ }
    },
    makeRecorder: () => {
      const r = new FakeRecorder()
      recs.push(r)
      return r
    },
    onClip: (bytes, mime) => clips.push({ bytes, mime }),
    onError: (m) => errors.push(m)
  })
  return { v, clips, errors, streams, recs, deny }
}
const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('hold and release', () => {
  it('records while held and delivers one clip on release; the mic is released after', async () => {
    const r = rig()
    r.v.start()
    await flush()
    expect(r.v.recording).toBe(true)
    vi.advanceTimersByTime(1500)
    r.v.stop()
    await flush()
    expect(r.clips).toHaveLength(1)
    expect([...r.clips[0].bytes]).toEqual([1, 2, 3])
    expect(r.clips[0].mime).toBe('audio/webm')
    expect(r.streams[0].tracksStopped).toBe(1)
    expect(r.v.recording).toBe(false)
  })
  it('a quick tap (shorter than the minimum) is thrown away, mic still released', async () => {
    const r = rig()
    r.v.start()
    await flush()
    vi.advanceTimersByTime(VOICE.minMs - 100)
    r.v.stop()
    await flush()
    expect(r.clips).toHaveLength(0)
    expect(r.errors).toHaveLength(1) // and the user is told why nothing happened
    expect(r.streams[0].tracksStopped).toBe(1)
  })
  it('stop with nothing started does nothing', async () => {
    const r = rig()
    r.v.stop()
    await flush()
    expect(r.clips).toHaveLength(0)
    expect(r.errors).toHaveLength(0)
  })
  it('a second start while recording is ignored (one stream, one recorder)', async () => {
    const r = rig()
    r.v.start()
    r.v.start()
    await flush()
    r.v.start()
    await flush()
    expect(r.streams).toHaveLength(1)
    expect(r.recs).toHaveLength(1)
  })
  it('released before the mic even opened: nothing recorded and the mic is closed as soon as it opens', async () => {
    const r = rig()
    r.v.start()
    r.v.stop() // same tick, the stream is not ready yet
    await flush()
    expect(r.clips).toHaveLength(0)
    expect(r.recs.every((x) => x.state === 'inactive')).toBe(true)
    expect(r.streams.every((s) => s.tracksStopped === 1)).toBe(true)
    expect(r.v.recording).toBe(false)
  })
  it('works again after a clip (hold, release, hold, release)', async () => {
    const r = rig()
    for (let i = 0; i < 3; i++) {
      r.v.start()
      await flush()
      vi.advanceTimersByTime(1000)
      r.v.stop()
      await flush()
    }
    expect(r.clips).toHaveLength(3)
    expect(r.streams.every((s) => s.tracksStopped === 1)).toBe(true)
  })
})

describe('the safety cap', () => {
  it('a stuck button stops the recording by itself after the maximum, and delivers what it has', async () => {
    const r = rig()
    r.v.start()
    await flush()
    vi.advanceTimersByTime(VOICE.maxMs + 50)
    await flush()
    expect(r.clips).toHaveLength(1)
    expect(r.v.recording).toBe(false)
    expect(r.streams[0].tracksStopped).toBe(1)
  })
  it('a normal release does not leave the cap timer to fire later', async () => {
    const r = rig()
    r.v.start()
    await flush()
    vi.advanceTimersByTime(1000)
    r.v.stop()
    await flush()
    vi.advanceTimersByTime(VOICE.maxMs * 2)
    await flush()
    expect(r.clips).toHaveLength(1)
  })
})

describe('an old cap timer', () => {
  it('never cuts short the NEXT hold (hold 1 s, release, hold again: still recording 8.5 s into the second)', async () => {
    const r = rig()
    r.v.start()
    await flush()
    vi.advanceTimersByTime(1000)
    r.v.stop()
    await flush()
    vi.advanceTimersByTime(1000)
    r.v.start()
    await flush()
    vi.advanceTimersByTime(VOICE.maxMs - 1500) // past where the FIRST hold's cap would have fired
    await flush()
    expect(r.v.recording).toBe(true)
  })
})

describe('no microphone', () => {
  it('blocked or missing: reports once, does not throw, and works again if allowed later', async () => {
    const r = rig()
    r.deny.on = true
    r.v.start()
    await flush()
    expect(r.errors).toHaveLength(1)
    expect(r.v.recording).toBe(false)
    r.v.stop()
    await flush()
    r.deny.on = false
    r.v.start()
    await flush()
    vi.advanceTimersByTime(1000)
    r.v.stop()
    await flush()
    expect(r.clips).toHaveLength(1)
  })
})

describe('fuzz', () => {
  it('3,000 random start/stop/time steps: never throws, never leaves a mic open at the end', async () => {
    let seed = 9
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const r = rig()
    for (let i = 0; i < 3000; i++) {
      const x = rand()
      if (x < 0.4) r.v.start()
      else if (x < 0.8) r.v.stop()
      else vi.advanceTimersByTime(rand() * 4000)
      if (rand() < 0.5) await flush()
      if (rand() < 0.02) r.deny.on = !r.deny.on
    }
    r.v.stop()
    vi.advanceTimersByTime(VOICE.maxMs + 100)
    await flush()
    expect(r.v.recording).toBe(false)
    expect(r.streams.every((s) => s.tracksStopped === 1)).toBe(true)
  })
})
