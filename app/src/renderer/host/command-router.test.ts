// Command router (P3 serial, phase D2): what happens to typed or spoken text. Ask the AI (via the main
// process); if it fails, hand the raw text to the dog, whose fixed word list takes over.
import { describe, expect, it } from 'vitest'
import { routeCommand } from './command-router'

const run = async (answer: string | Error | 'hang', text = 'go lie down'): Promise<string[]> => {
  const sent: string[] = []
  await routeCommand(
    text,
    async () => {
      if (answer instanceof Error) throw answer
      return answer as never
    },
    (t) => sent.push(t)
  )
  return sent
}

describe('routeCommand', () => {
  it('the AI picked a command: that command is sent', async () => {
    expect(await run('lie_down')).toEqual(['lie_down'])
  })
  it('the AI says it is not a dog action: an empty command (the dog tilts its head)', async () => {
    expect(await run('none', 'sit, I mean never mind')).toEqual([''])
  })
  it('the AI failed (offline, no key): the raw text goes to the word list', async () => {
    expect(await run('error', 'sit down')).toEqual(['sit down'])
  })
  it('the bridge itself throwing counts as a failure too', async () => {
    expect(await run(new Error('ipc gone'), 'come here')).toEqual(['come here'])
  })
  it('exactly one command is sent each time', async () => {
    for (const a of ['sit', 'none', 'error']) expect(await run(a)).toHaveLength(1)
  })
  it('blank text sends nothing at all', async () => {
    expect(await run('sit', '   ')).toEqual([])
  })
})
