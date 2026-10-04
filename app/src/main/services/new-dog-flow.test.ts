// New-dog flow (E2): "Upload new dog…" end to end in the main process: pick a photo, shrink it, make the
// dog (parallel Gemini calls, median, colours), report EVERY step for the screen and the terminal, and
// save it. Everything is injected, so it is tested with fakes. A failure never replaces the current dog.
import { describe, expect, it } from 'vitest'
import type { NewDogProgress } from '../../shared/ipc'
import { DEFAULT_SPEC, normalizeSpec } from '../../renderer/dog/spec/dog-spec'
import { NewDogFlow, STEPS, type FlowDeps } from './new-dog-flow'
import type { SpecAnswer } from './dog-from-photo'

const ANSWER = (size = 1.2): SpecAnswer => ({ ...normalizeSpec({ size }) })

interface Rig {
  flow: NewDogFlow
  progress: NewDogProgress[]
  logs: string[]
  saved: unknown[]
  cleared: number
  deps: FlowDeps
}
function rig(over: Partial<FlowDeps> = {}): Rig {
  const progress: NewDogProgress[] = []
  const logs: string[] = []
  const saved: unknown[] = []
  const r = { cleared: 0 } as Rig
  let clock = 0
  const deps: FlowDeps = {
    pick: async () => '/photos/Rex the Dog.JPG',
    readFile: async () => new Uint8Array(200_000).fill(9),
    prepare: () => ({
      jpeg: new Uint8Array(40_000).fill(7),
      pixels: { width: 2, height: 2, data: new Uint8Array(12) }
    }),
    ask: async () => ANSWER(),
    save: async (spec) => {
      saved.push(spec)
    },
    load: async () => null,
    clear: async () => {
      r.cleared++
    },
    progress: (p) => progress.push(p),
    log: (m) => logs.push(m),
    now: () => (clock += 1000),
    ...over
  }
  r.flow = new NewDogFlow(deps)
  r.progress = progress
  r.logs = logs
  r.saved = saved
  r.deps = deps
  return r
}

describe('the happy path', () => {
  it('makes the dog, names it after the photo, saves it, and says done', async () => {
    const r = rig()
    const res = await r.flow.run()
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.name).toBe('rex-the-dog')
    expect((res.spec as { name: string; size: number }).name).toBe('rex-the-dog')
    expect((res.spec as { size: number }).size).toBe(1.2)
    expect(r.saved).toHaveLength(1)
    expect(r.progress.at(-1)?.state).toBe('done')
    expect(r.progress.at(-1)?.percent).toBe(100)
    expect(r.progress.at(-1)?.message).toBe('rex-the-dog')
  })
  it('shows the whole step list every time, and the current step only moves forward', async () => {
    const r = rig()
    await r.flow.run()
    for (const p of r.progress) expect(p.steps).toEqual(STEPS)
    const cur = r.progress.map((p) => p.current)
    expect(cur).toEqual([...cur].sort((a, b) => a - b))
    expect(new Set(cur).size).toBeGreaterThanOrEqual(4)
    const pct = r.progress.map((p) => p.percent)
    expect(pct).toEqual([...pct].sort((a, b) => a - b)) // the bar never goes backwards
  })
  it('logs a readable line for each stage, with the photo name, sizes, calls and total time', async () => {
    const r = rig()
    await r.flow.run()
    const text = r.logs.join('\n')
    expect(text).toMatch(/\[new-dog\].*Rex the Dog\.JPG/)
    expect(text).toMatch(/shrunk|prepared/i)
    expect(text).toMatch(/call 1\/3 ok/)
    expect(text).toMatch(/call 3\/3 ok/)
    expect(text).toMatch(/combin|merg/i)
    expect(text).toMatch(/saved/i)
    expect(text).toMatch(/done in \d+(\.\d+)? s/)
    for (const l of r.logs) expect(l.startsWith('[new-dog]')).toBe(true)
  })
  it('the detail text tells what is happening (which call finished)', async () => {
    const r = rig()
    await r.flow.run()
    expect(r.progress.some((p) => /1 of 3/.test(p.detail))).toBe(true)
  })
})

describe('when it does not work, the current dog stays (nothing is saved, nothing is swapped)', () => {
  it('cancelling the picker is quiet: no progress card, no error', async () => {
    const r = rig({ pick: async () => null })
    const res = await r.flow.run()
    expect(res).toEqual({ ok: false, cancelled: true, message: 'cancelled' })
    expect(r.progress).toHaveLength(0)
    expect(r.saved).toHaveLength(0)
  })
  it('a file that is not a readable image says so', async () => {
    const r = rig({ prepare: () => null })
    const res = await r.flow.run()
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.message).toMatch(/couldn.t read|not an image|JPG|PNG/i)
    expect(r.progress.at(-1)?.state).toBe('error')
    expect(r.saved).toHaveLength(0)
  })
  it('a file that cannot be opened says so', async () => {
    const r = rig({
      readFile: async () => {
        throw new Error('EACCES')
      }
    })
    const res = await r.flow.run()
    expect(res.ok).toBe(false)
    expect(r.progress.at(-1)?.state).toBe('error')
  })
  it('a huge file is refused before anything is sent anywhere', async () => {
    let asked = 0
    const r = rig({
      readFile: async () => new Uint8Array(30 * 1024 * 1024),
      ask: async () => (asked++, ANSWER())
    })
    const res = await r.flow.run()
    expect(res.ok).toBe(false)
    expect(asked).toBe(0)
    if (!res.ok) expect(res.message).toMatch(/too big|large/i)
  })
  it('Gemini failing every time is an error (not a generic dog swapped in), with the reason', async () => {
    const r = rig({
      ask: async () => {
        throw new Error('Gemini answered HTTP 429')
      }
    })
    const res = await r.flow.run()
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.message).toMatch(/Gemini|internet|try again/i)
    expect(r.saved).toHaveLength(0)
    expect(r.progress.at(-1)?.state).toBe('error')
    expect(r.logs.join('\n')).toMatch(/call 1\/3 FAILED.*429/)
  })
  it('no Gemini key gives a message that says where to put it', async () => {
    const r = rig({
      ask: async () => {
        throw new Error('no Gemini key (set GEMINI_API_KEY in .env)')
      }
    })
    const res = await r.flow.run()
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.message).toMatch(/GEMINI_API_KEY/)
  })
  it('one or two calls failing is fine: the dog is still made from the rest', async () => {
    let n = 0
    const r = rig({
      ask: async () => {
        if (++n < 3) throw new Error('boom')
        return ANSWER(1.4)
      }
    })
    const res = await r.flow.run()
    expect(res.ok).toBe(true)
    expect(r.logs.join('\n')).toMatch(/1 of 3 calls worked|1\/3 calls ok/i)
  })
  it('if saving fails the dog is still made (it just will not be remembered), and the log says so', async () => {
    const r = rig({
      save: async () => {
        throw new Error('disk full')
      }
    })
    const res = await r.flow.run()
    expect(res.ok).toBe(true)
    expect(r.logs.join('\n')).toMatch(/could not save.*disk full/i)
  })
})

describe('one at a time, and safe', () => {
  it('a second run while one is going is refused (and does not disturb the first)', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((res) => (release = res))
    const r = rig({ pick: async () => (await gate, '/p/dog.png') })
    const first = r.flow.run()
    const second = await r.flow.run()
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.message).toMatch(/already/i)
    expect(r.flow.busy).toBe(true)
    release()
    expect((await first).ok).toBe(true)
    expect(r.flow.busy).toBe(false)
  })
  it('after a failure it can be run again', async () => {
    let fail = true
    const r = rig({
      ask: async () => {
        if (fail) throw new Error('x')
        return ANSWER()
      }
    })
    expect((await r.flow.run()).ok).toBe(false)
    fail = false
    expect((await r.flow.run()).ok).toBe(true)
  })
  it('a progress listener that throws cannot break the run', async () => {
    const r = rig({
      progress: () => {
        throw new Error('ui bug')
      }
    })
    expect((await r.flow.run()).ok).toBe(true)
  })
  it('the photo name is cleaned into a safe dog name (any characters, any length)', async () => {
    for (const [path, want] of [
      ['/a/b/My Dog!!.png', 'my-dog'],
      ['C:\\pics\\ÉMILE (1).jpeg', 'emile-1'],
      ['/x/' + 'a'.repeat(200) + '.jpg', 'a'.repeat(40)],
      ['/x/!!!.jpg', 'dog']
    ] as const) {
      const r = rig({ pick: async () => path })
      const res = await r.flow.run()
      expect(res.ok && res.name).toBe(want)
    }
  })
})

describe('the saved dog', () => {
  it('load returns a safe spec (junk is repaired), or null when nothing is saved', async () => {
    expect(await rig().flow.saved()).toBeNull()
    const r = rig({ load: async () => ({ name: 'x', size: 99, colors: { coat: 'nope' } }) })
    const s = await r.flow.saved()
    expect(s?.size).toBeLessThanOrEqual(1.6)
    expect(s?.colors.coat).toBe(DEFAULT_SPEC.colors.coat)
  })
  it('a load that throws is just "nothing saved"', async () => {
    const r = rig({
      load: async () => {
        throw new Error('corrupt')
      }
    })
    expect(await r.flow.saved()).toBeNull()
  })
  it('reset clears it and logs', async () => {
    const r = rig()
    await r.flow.reset()
    expect(r.cleared).toBe(1)
    expect(r.logs.join('\n')).toMatch(/original dog/i)
  })
})
