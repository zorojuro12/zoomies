// What happens to a finished recording: words -> the command router; nothing heard or a failure -> the
// dog tilts its head (an empty command), never a silent dead end.
import { describe, expect, it } from 'vitest'
import { handleClip } from './voice-flow'

const run = async (heard: string | null | Error): Promise<string[]> => {
  const routed: string[] = []
  const sent: string[] = []
  await handleClip(
    new Uint8Array([1]),
    'audio/webm',
    async () => {
      if (heard instanceof Error) throw heard
      return heard
    },
    (t) => routed.push(t),
    (t) => sent.push(t)
  )
  return [...routed.map((t) => `route:${t}`), ...sent.map((t) => `send:${t}`)]
}

describe('handleClip', () => {
  it('words heard: routed to the command router', async () => {
    expect(await run('go lie down')).toEqual(['route:go lie down'])
  })
  it('nothing heard: head tilt', async () => {
    expect(await run('')).toEqual(['send:'])
  })
  it('transcription failed: head tilt', async () => {
    expect(await run(null)).toEqual(['send:'])
  })
  it('the bridge throwing: head tilt, no crash', async () => {
    expect(await run(new Error('ipc'))).toEqual(['send:'])
  })
})
