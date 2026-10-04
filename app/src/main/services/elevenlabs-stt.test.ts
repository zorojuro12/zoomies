// ElevenLabs speech-to-text (P3 serial, phase D3). Fake fetch only. Returns the words, '' when nothing was
// heard, null when it failed (no key, offline, timeout, bad clip). The key only ever goes in a header.
import { describe, expect, it } from 'vitest'
import { transcribe, type FetchLike } from './elevenlabs-stt'

const KEY = 'xi-test-key'
const clip = (n = 5000): Uint8Array => new Uint8Array(n).fill(7)

function okFetch(body: unknown, calls: { url: string; init: RequestInit }[] = []): FetchLike {
  return async (url, init) => {
    calls.push({ url, init })
    return { ok: true, status: 200, json: async () => body }
  }
}

describe('what comes back', () => {
  it('the transcribed text, trimmed', async () => {
    expect(
      await transcribe(clip(), 'audio/webm', {
        apiKey: KEY,
        fetch: okFetch({ text: '  Go lie down. ' })
      })
    ).toBe('Go lie down.')
  })
  it('nothing heard -> empty string (not a failure)', async () => {
    expect(
      await transcribe(clip(), 'audio/webm', { apiKey: KEY, fetch: okFetch({ text: '' }) })
    ).toBe('')
  })
  it('garbage bodies -> null', async () => {
    for (const body of [null, {}, { text: 5 }, 'x', []]) {
      expect(
        await transcribe(clip(), 'audio/webm', { apiKey: KEY, fetch: okFetch(body) })
      ).toBeNull()
    }
  })
  it('very long text is cut to 300 characters', async () => {
    const r = await transcribe(clip(), 'audio/webm', {
      apiKey: KEY,
      fetch: okFetch({ text: 'a'.repeat(5000) })
    })
    expect(r).toHaveLength(300)
  })
})

describe('failures never throw', () => {
  it('HTTP error -> null', async () => {
    const f: FetchLike = async () => ({ ok: false, status: 401, json: async () => ({}) })
    expect(await transcribe(clip(), 'audio/webm', { apiKey: KEY, fetch: f })).toBeNull()
  })
  it('network failure -> null', async () => {
    const f: FetchLike = async () => {
      throw new Error('offline')
    }
    expect(await transcribe(clip(), 'audio/webm', { apiKey: KEY, fetch: f })).toBeNull()
  })
  it('too slow -> null, and the request is aborted', async () => {
    let aborted = false
    const f: FetchLike = (_u, init) =>
      new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => {
          aborted = true
          rej(new Error('aborted'))
        })
      })
    expect(
      await transcribe(clip(), 'audio/webm', { apiKey: KEY, fetch: f, timeoutMs: 30 })
    ).toBeNull()
    expect(aborted).toBe(true)
  })
  it('no key -> null, no request', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    expect(
      await transcribe(clip(), 'audio/webm', {
        apiKey: undefined,
        fetch: okFetch({ text: 'x' }, calls)
      })
    ).toBeNull()
    expect(calls).toHaveLength(0)
  })
  it('a clip that is empty, tiny, or huge is refused without a request', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const f = okFetch({ text: 'x' }, calls)
    expect(await transcribe(new Uint8Array(0), 'audio/webm', { apiKey: KEY, fetch: f })).toBeNull()
    expect(
      await transcribe(new Uint8Array(100), 'audio/webm', { apiKey: KEY, fetch: f })
    ).toBeNull()
    expect(
      await transcribe(new Uint8Array(6 * 1024 * 1024), 'audio/webm', { apiKey: KEY, fetch: f })
    ).toBeNull()
    expect(calls).toHaveLength(0)
  })
})

describe('what is sent', () => {
  it('key in a header only; the model and the audio file in the form', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    await transcribe(clip(), 'audio/webm;codecs=opus', {
      apiKey: KEY,
      fetch: okFetch({ text: 'x' }, calls)
    })
    const { url, init } = calls[0]
    expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text')
    expect(url.includes(KEY)).toBe(false)
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe(KEY)
    const form = init.body as FormData
    expect(form.get('model_id')).toBe('scribe_v1')
    const file = form.get('file') as File
    expect(file.size).toBe(5000)
    expect(file.type.startsWith('audio/webm')).toBe(true)
  })
})
