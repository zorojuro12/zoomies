// Dog from a photo (new-dog flow, E1): the TypeScript twin of pipeline/zoomies_pipeline/{aggregate,
// photo_to_spec}.py. Several parallel Gemini calls, the MEDIAN answer, colours snapped to the photo, and it
// ALWAYS ends with a valid spec (all calls failing gives the default template dog). Fake model only.
import { describe, expect, it } from 'vitest'
import {
  PROMPT,
  RESPONSE_SCHEMA,
  aggregateSpecs,
  askGemini,
  median,
  photoToSpec,
  type FetchLike,
  type SpecAnswer
} from './dog-from-photo'
import {
  COLOR_KEYS,
  DEFAULT_SPEC,
  PROPORTION_KEYS,
  normalizeSpec
} from '../../renderer/dog/spec/dog-spec'
import type { DogSpec } from '../../renderer/dog/spec/dog-spec'
import type { RgbImage } from './photo-colors'

interface SpecOver {
  size?: number
  earType?: DogSpec['earType']
  tailType?: DogSpec['tailType']
  proportions?: Partial<DogSpec['proportions']>
  colors?: Partial<DogSpec['colors']>
}
const spec = (over: SpecOver = {}): DogSpec => {
  const base = normalizeSpec({})
  return {
    ...base,
    ...over,
    proportions: { ...base.proportions, ...over.proportions },
    colors: { ...base.colors, ...over.colors }
  }
}

describe('median', () => {
  it('odd and even counts', () => {
    expect(median([1, 3, 2])).toBe(2)
    expect(median([1, 2, 3, 10])).toBe(2.5)
    expect(median([7])).toBe(7)
  })
  it('no values is an error', () => {
    expect(() => median([])).toThrow()
  })
})

describe('aggregateSpecs', () => {
  it('one wild answer does not win the numbers', () => {
    const out = aggregateSpecs([
      spec({ proportions: { legLength: 0.9 } }),
      spec({ proportions: { legLength: 1.0 } }),
      spec({ proportions: { legLength: 1.6 } })
    ])
    expect(out.proportions.legLength).toBe(1)
  })
  it('size is a median too', () => {
    expect(aggregateSpecs([spec({ size: 0.8 }), spec({ size: 1 }), spec({ size: 1.4 })]).size).toBe(
      1
    )
  })
  it('ear and tail type: majority vote; a three-way tie goes to the first answer', () => {
    const a = aggregateSpecs([
      spec({ earType: 'floppy', tailType: 'stub' }),
      spec({ earType: 'floppy', tailType: 'long' }),
      spec({ earType: 'pointy', tailType: 'long' })
    ])
    expect([a.earType, a.tailType]).toEqual(['floppy', 'long'])
    expect(
      aggregateSpecs([
        spec({ earType: 'pointy' }),
        spec({ earType: 'semi' }),
        spec({ earType: 'floppy' })
      ]).earType
    ).toBe('pointy')
  })
  it('colours are medianed per channel (hand worked: R 0,100,200 -> 100; G 0,100,50 -> 50; B 0,100,10 -> 10)', () => {
    const out = aggregateSpecs([
      spec({ colors: { coat: '#000000' } }),
      spec({ colors: { coat: '#646464' } }),
      spec({ colors: { coat: '#c8320a' } })
    ])
    expect(out.colors.coat).toBe('#64320a')
  })
  it('two agreeing colours beat one outlier', () => {
    const out = aggregateSpecs([
      spec({ colors: { nose: '#101010' } }),
      spec({ colors: { nose: '#101010' } }),
      spec({ colors: { nose: '#ffffff' } })
    ])
    expect(out.colors.nose).toBe('#101010')
  })
  it('a single answer comes back unchanged', () => {
    const s = spec({ earType: 'floppy', proportions: { legLength: 0.7 } })
    expect(aggregateSpecs([s])).toEqual(s)
  })
  it('no answers is an error', () => {
    expect(() => aggregateSpecs([])).toThrow()
  })
  it('numbers are rounded to 4 places; the result is a valid spec; inputs are untouched', () => {
    const a = spec({ size: 0.9 })
    const b = spec({ size: 1.1111111 })
    const before = JSON.stringify([a, b])
    const out = aggregateSpecs([a, b])
    expect(out.size).toBe(1.0056)
    expect(normalizeSpec(out)).toEqual(out)
    expect(JSON.stringify([a, b])).toBe(before)
  })
  it('junk inside an answer is repaired, not propagated', () => {
    const out = aggregateSpecs([
      { size: 'big', colors: { coat: 'red' } } as unknown as SpecAnswer,
      spec()
    ])
    expect(out.size).toBe(1)
    expect(out.colors.coat).toBe(DEFAULT_SPEC.colors.coat)
  })
})

const IMG = new Uint8Array([1, 2, 3, 4])
const answer = (over: SpecOver = {}): SpecAnswer => ({ ...spec(over) })

describe('photoToSpec: robust, and it never fails', () => {
  it('takes the median of the calls and reports it', async () => {
    const sizes = [0.8, 1, 1.4]
    let i = 0
    const r = await photoToSpec({
      image: IMG,
      mime: 'image/jpeg',
      name: 'rex',
      ask: async () => answer({ size: sizes[i++] })
    })
    expect(r.spec.size).toBe(1)
    expect(r.spec.name).toBe('rex')
    expect(r.report.callsOk).toBe(3)
    expect(r.report.fallback).toBe(false)
  })
  it('one failing call does not stop the others; a non-object answer counts as a failure', async () => {
    let i = 0
    const r = await photoToSpec({
      image: IMG,
      mime: 'image/jpeg',
      name: 'rex',
      ask: async () => {
        i++
        if (i === 1) throw new Error('boom')
        if (i === 2) return 'not json' as never
        return answer({ size: 1.2 })
      }
    })
    expect(r.spec.size).toBe(1.2)
    expect(r.report.callsOk).toBe(1)
    expect(r.report.callsFailed).toBe(2)
    expect(r.report.errors.length).toBe(2)
  })
  it('all calls failing gives the default template dog (never throws), under the right name', async () => {
    const r = await photoToSpec({
      image: IMG,
      mime: 'image/jpeg',
      name: 'rex',
      ask: async () => {
        throw new Error('offline')
      }
    })
    expect(r.report.fallback).toBe(true)
    expect(r.spec).toEqual({ ...DEFAULT_SPEC, name: 'rex' })
  })
  it('a hanging call is abandoned after the timeout and the rest still count', async () => {
    let i = 0
    const t0 = Date.now()
    const r = await photoToSpec({
      image: IMG,
      mime: 'image/jpeg',
      name: 'rex',
      timeoutMs: 40,
      ask: () =>
        ++i === 1
          ? new Promise<SpecAnswer>(() => undefined)
          : Promise.resolve(answer({ size: 1.3 }))
    })
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(r.report.callsOk).toBe(2)
    expect(r.report.errors.some((e) => e.includes('timeout'))).toBe(true)
  })
  it('the calls run in parallel (the wait is the slowest call, not the sum)', async () => {
    const t0 = Date.now()
    await photoToSpec({
      image: IMG,
      mime: 'image/jpeg',
      name: 'rex',
      ask: () => new Promise<SpecAnswer>((res) => setTimeout(() => res(answer()), 80))
    })
    expect(Date.now() - t0).toBeLessThan(200) // 3 x 80 ms in a row would be 240+
  })
  it('the number of calls is configurable', async () => {
    let n = 0
    await photoToSpec({
      image: IMG,
      mime: 'image/jpeg',
      name: 'x',
      calls: 5,
      ask: async () => (n++, answer())
    })
    expect(n).toBe(5)
  })
  it('the source photo name is recorded when given', async () => {
    const r = await photoToSpec({
      image: IMG,
      mime: 'image/jpeg',
      name: 'rex',
      sourcePhoto: 'photo/rex.jpg',
      ask: async () => answer()
    })
    expect(r.spec.sourcePhoto).toBe('photo/rex.jpg')
  })
})

/** 100x100 grey backdrop with a red block: the palette is red. */
function redPhoto(): RgbImage {
  const w = 100
  const data = new Uint8Array(w * w * 3)
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      const red = x >= 20 && x < 80 && y >= 20 && y < 80
      const c = red ? [200, 0, 0] : [138, 143, 148]
      data.set(c, (y * w + x) * 3)
    }
  return { width: w, height: w, data }
}

describe('colours get a tiny correction from the photo, never a big one', () => {
  it('a colour nearly right snaps to the photo; one far from every photo colour is kept', async () => {
    const r = await photoToSpec({
      image: IMG,
      mime: 'image/jpeg',
      name: 'rex',
      pixels: redPhoto(),
      ask: async () =>
        answer({ colors: { ...DEFAULT_SPEC.colors, coat: '#c60303', nose: '#00ff00' } })
    })
    expect(r.spec.colors.coat).toBe('#c80000')
    expect(r.spec.colors.nose).toBe('#00ff00')
    expect(r.report.snapped.coat).toBeTruthy()
    expect(r.report.palette.length).toBeGreaterThan(0)
  })
  it('the snap distance can be widened, or turned off with 0', async () => {
    const mk = (snapDelta: number): Promise<{ spec: DogSpec }> =>
      photoToSpec({
        image: IMG,
        mime: 'image/jpeg',
        name: 'x',
        pixels: redPhoto(),
        snapDelta,
        ask: async () => answer({ colors: { ...DEFAULT_SPEC.colors, coat: '#b01818' } })
      })
    expect((await mk(0)).spec.colors.coat).toBe('#b01818')
    expect((await mk(35)).spec.colors.coat).toBe('#c80000')
    expect((await mk(undefined as never)).spec.colors.coat).toBe('#b01818') // the default limit (10) is small
  })
  it('a photo that cannot be read for colours does not lose the spec', async () => {
    const r = await photoToSpec({
      image: IMG,
      mime: 'image/jpeg',
      name: 'x',
      pixels: { width: 10, height: 10, data: new Uint8Array(3) },
      ask: async () => answer({ size: 1.3 })
    })
    expect(r.spec.size).toBe(1.3)
  })
})

function okFetch(text: string, calls: { url: string; init: RequestInit }[] = []): FetchLike {
  return async (url, init) => {
    calls.push({ url, init })
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] })
    }
  }
}

describe('progress (what the screen and the log show)', () => {
  it('reports each step in order: asking, every call, merging, colours, done', async () => {
    const seen: string[] = []
    await photoToSpec({
      image: IMG,
      mime: 'image/jpeg',
      name: 'rex',
      pixels: redPhoto(),
      ask: async () => answer(),
      onProgress: (p) =>
        seen.push(
          p.stage === 'call' ? `call ${p.done}/${p.total} ${p.ok ? 'ok' : 'failed'}` : p.stage
        )
    })
    expect(seen).toEqual([
      'asking',
      'call 1/3 ok',
      'call 2/3 ok',
      'call 3/3 ok',
      'merging',
      'colors',
      'done'
    ])
  })
  it('a failed call says why, and an all-failed run reports the fallback', async () => {
    const seen: { stage: string; error?: string }[] = []
    await photoToSpec({
      image: IMG,
      mime: 'image/jpeg',
      name: 'rex',
      ask: async () => {
        throw new Error('Gemini answered HTTP 429')
      },
      onProgress: (p) => seen.push(p as never)
    })
    expect(
      seen.filter((p) => p.stage === 'call').every((p) => p.error === 'Gemini answered HTTP 429')
    ).toBe(true)
    expect(seen.some((p) => p.stage === 'fallback')).toBe(true)
    expect(seen.at(-1)?.stage).toBe('done')
  })
  it('a progress listener that throws cannot break the run', async () => {
    const r = await photoToSpec({
      image: IMG,
      mime: 'image/jpeg',
      name: 'rex',
      ask: async () => answer({ size: 1.2 }),
      onProgress: () => {
        throw new Error('listener bug')
      }
    })
    expect(r.spec.size).toBe(1.2)
  })
})

describe('askGemini (one real call, faked)', () => {
  it('sends the photo inline with the prompt, the schema and low temperature; key only in a header', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const out = await askGemini(Uint8Array.from([1, 2, 3]), 'image/png', {
      apiKey: 'K-123',
      model: 'm-1',
      fetch: okFetch(JSON.stringify({ size: 1.2 }), calls)
    })
    expect(out).toEqual({ size: 1.2 })
    const { url, init } = calls[0]
    expect(url).toContain('/models/m-1:generateContent')
    expect(url.includes('K-123')).toBe(false)
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('K-123')
    const body = JSON.parse(String(init.body))
    const parts = body.contents[0].parts
    expect(parts[0].inline_data).toEqual({
      mime_type: 'image/png',
      data: Buffer.from([1, 2, 3]).toString('base64')
    })
    expect(parts[1].text).toBe(PROMPT)
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseJsonSchema).toEqual(RESPONSE_SCHEMA)
    expect(body.generationConfig.temperature).toBe(0.2)
    expect(String(init.body).includes('K-123')).toBe(false)
  })
  it('an HTTP error, a missing key, and a bad answer all throw (photoToSpec counts them as failed calls)', async () => {
    const bad: FetchLike = async () => ({ ok: false, status: 429, json: async () => ({}) })
    await expect(askGemini(IMG, 'image/png', { apiKey: 'k', fetch: bad })).rejects.toThrow()
    await expect(
      askGemini(IMG, 'image/png', { apiKey: '', fetch: okFetch('{}') })
    ).rejects.toThrow()
    await expect(
      askGemini(IMG, 'image/png', { apiKey: 'k', fetch: okFetch('not json') })
    ).rejects.toThrow()
  })
})

describe('the prompt and schema cover every spec field', () => {
  it('every proportion and colour is asked for, with a description', () => {
    const props = RESPONSE_SCHEMA.properties.proportions
    expect([...props.required]).toEqual([...PROPORTION_KEYS])
    for (const k of PROPORTION_KEYS)
      expect(props.properties[k].description.length).toBeGreaterThan(10)
    const cols = RESPONSE_SCHEMA.properties.colors
    expect([...cols.required]).toEqual([...COLOR_KEYS])
    expect(RESPONSE_SCHEMA.properties.earType.enum).toEqual(['pointy', 'semi', 'floppy'])
    expect(RESPONSE_SCHEMA.properties.tailType.enum).toEqual(['long', 'fluffy', 'stub', 'curled'])
    expect(PROMPT).toMatch(/#rrggbb/)
  })
})
