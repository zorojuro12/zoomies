// ElevenLabs speech-to-text (P3 serial, phase D3; PRD L2). A short recording in, the words out.
// Main process only (the key never reaches the page); async, short timeout.
//   text      what was heard (trimmed, capped at 300 characters); '' = nothing heard
//   null      it failed: no key, offline, timeout, a bad or oversized clip. The dog tilts its head.
export type FetchLike = (
  url: string,
  init: RequestInit
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

export interface TranscribeOptions {
  apiKey: string | undefined
  timeoutMs?: number
  fetch?: FetchLike
}

export const STT = {
  url: 'https://api.elevenlabs.io/v1/speech-to-text',
  model: 'scribe_v1',
  /** Smaller than this is not speech (a click); larger is not a push-to-talk. */
  minBytes: 1000,
  maxBytes: 5 * 1024 * 1024,
  maxText: 300
}

export async function transcribe(
  audio: Uint8Array,
  mime: string,
  opts: TranscribeOptions
): Promise<string | null> {
  if (!opts.apiKey) return null
  if (!(audio instanceof Uint8Array) || audio.length < STT.minBytes || audio.length > STT.maxBytes)
    return null
  const type = typeof mime === 'string' && mime.startsWith('audio/') ? mime : 'audio/webm'
  const doFetch = opts.fetch ?? ((url, init) => fetch(url, init))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6000)
  try {
    const form = new FormData()
    form.append('model_id', STT.model)
    form.append('file', new Blob([audio.slice()], { type }), 'speech.webm')
    const res = await doFetch(STT.url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'xi-api-key': opts.apiKey },
      body: form
    })
    if (!res.ok) return null
    const text = ((await res.json()) as { text?: unknown } | null)?.text
    return typeof text === 'string' ? text.trim().slice(0, STT.maxText) : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
