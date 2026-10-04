import { describe, expect, it } from 'vitest'
import { WebAudioPlayer } from './web-audio-player'

// Minimal stand-ins for the Web Audio nodes the player touches.
class FakeParam {
  value = 1
  cancelScheduledValues(): void {
    /* no-op */
  }
  setValueAtTime(): void {
    /* no-op */
  }
  linearRampToValueAtTime(): void {
    /* no-op */
  }
}
class FakeNode {
  connect(node: unknown): unknown {
    return node
  }
  disconnect(): void {
    /* no-op */
  }
}
class FakeSource extends FakeNode {
  buffer: unknown = null
  loop = false
  started = false
  stopped = false
  onended: (() => void) | null = null
  start(): void {
    this.started = true
  }
  stop(): void {
    this.stopped = true
  }
}
class FakeGain extends FakeNode {
  gain = new FakeParam()
}
class FakePan extends FakeNode {
  pan = new FakeParam()
}
class FakeContext {
  state = 'running'
  currentTime = 0
  destination = {}
  sources: FakeSource[] = []
  gains: FakeGain[] = []
  pans: FakePan[] = []
  resume(): Promise<void> {
    return Promise.resolve()
  }
  // The "audio" is just the byte length, so tests can tell variants apart.
  decodeAudioData(bytes: ArrayBuffer): Promise<unknown> {
    return Promise.resolve({ id: bytes.byteLength })
  }
  createBufferSource(): FakeSource {
    const s = new FakeSource()
    this.sources.push(s)
    return s
  }
  createGain(): FakeGain {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createStereoPanner(): FakePan {
    const p = new FakePan()
    this.pans.push(p)
    return p
  }
}

/** A player whose "files" are the given asset paths, each a different size. */
function makePlayer(existing: string[]): { player: WebAudioPlayer; ctx: FakeContext } {
  const ctx = new FakeContext()
  const player = new WebAudioPlayer({
    createContext: () => ctx as unknown as AudioContext,
    loadBytes: (path) => {
      const i = existing.indexOf(path)
      return Promise.resolve(i < 0 ? null : new ArrayBuffer(i + 1))
    },
    random: () => 0
  })
  return { player, ctx }
}

const FILES = [
  'sounds/bark_happy_1.mp3',
  'sounds/bark_happy_2.mp3',
  'sounds/snore_1.mp3',
  'sounds/snore_2.mp3'
]

describe('WebAudioPlayer', () => {
  it('loads only the variants that exist', async () => {
    const { player } = makePlayer(FILES)
    await player.preload()
    expect(player.variantCount('bark_happy')).toBe(2)
    expect(player.variantCount('snore')).toBe(2)
    expect(player.variantCount('whine')).toBe(0)
  })

  it('is silent for sounds with no files or that have not loaded yet', async () => {
    const { player, ctx } = makePlayer(FILES)
    player.playSound('bark_happy') // before preload finished
    await player.preload()
    player.playSound('whine') // no files at all
    expect(ctx.sources).toHaveLength(0)
  })

  it('plays one-shots without looping and loops snore/pant by default', async () => {
    const { player, ctx } = makePlayer(FILES)
    await player.preload()
    player.playSound('bark_happy')
    player.playSound('snore')
    expect(ctx.sources.map((s) => [s.started, s.loop])).toEqual([
      [true, false],
      [true, true]
    ])
  })

  it('lets opts.loop override the default', async () => {
    const { player, ctx } = makePlayer(FILES)
    await player.preload()
    player.playSound('snore', { loop: false })
    expect(ctx.sources[0]?.loop).toBe(false)
  })

  it('clamps pan and gain', async () => {
    const { player, ctx } = makePlayer(FILES)
    await player.preload()
    player.playSound('bark_happy', { pan: 5, gain: 5 })
    player.playSound('bark_happy', { pan: -5, gain: -5 })
    expect(ctx.pans.map((p) => p.pan.value)).toEqual([1, -1])
    expect(ctx.gains.map((g) => g.gain.value)).toEqual([1, 0])
  })

  it('never plays the same variant twice in a row', async () => {
    const { player, ctx } = makePlayer(FILES)
    await player.preload()
    for (let i = 0; i < 6; i++) player.playSound('bark_happy')
    const ids = ctx.sources.map((s) => (s.buffer as { id: number }).id)
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1])
  })

  it('keeps one loop per sound and just updates its pan and volume', async () => {
    const { player, ctx } = makePlayer(FILES)
    await player.preload()
    player.playSound('snore', { pan: -0.5, gain: 0.8 })
    player.playSound('snore', { pan: 0.5, gain: 0.2 })
    expect(ctx.sources).toHaveLength(1)
    expect(ctx.pans[0]?.pan.value).toBe(0.5)
    expect(ctx.gains[0]?.gain.value).toBe(0.2)
  })

  it('stop() ends the loop, and the next play starts a fresh one', async () => {
    const { player, ctx } = makePlayer(FILES)
    await player.preload()
    player.playSound('snore')
    player.stop('snore')
    expect(ctx.sources[0]?.stopped).toBe(true)
    player.playSound('snore')
    expect(ctx.sources).toHaveLength(2)
    expect(ctx.sources[1]?.stopped).toBe(false)
  })

  it('stop() with nothing playing, or after a sound ended, is harmless', async () => {
    const { player, ctx } = makePlayer(FILES)
    await player.preload()
    expect(() => player.stop('bark_happy')).not.toThrow()
    player.playSound('bark_happy')
    ctx.sources[0]?.onended?.()
    expect(() => player.stop('bark_happy')).not.toThrow()
  })
})
