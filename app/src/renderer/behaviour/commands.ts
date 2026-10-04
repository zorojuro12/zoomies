// Commands (P3 serial, phase D1): the fixed command list. Anything that turns into a dog action goes
// through here: typed text, the buttons, the words the speech-to-text hears, and the tool name Gemini
// picks (D2) all end up as one of these seven names. It is also the fallback when the AI is offline.
export const COMMAND_NAMES = [
  'sit',
  'lie_down',
  'come',
  'fetch',
  'speak',
  'good_boy',
  'play_trick',
  'jump'
] as const
export type CommandName = (typeof COMMAND_NAMES)[number]

/** What the clickable buttons say. */
export const COMMAND_LABELS: Record<CommandName, string> = {
  sit: 'Sit',
  lie_down: 'Lie down',
  come: 'Come',
  fetch: 'Fetch',
  speak: 'Speak',
  good_boy: 'Good boy',
  play_trick: 'Trick',
  jump: 'Jump'
}

// Whole words only. The first word that means a command wins, so "sit down" is sit (not lie down).
const WORDS: Record<string, CommandName> = {
  sit: 'sit',
  lie: 'lie_down',
  lay: 'lie_down',
  down: 'lie_down',
  come: 'come',
  here: 'come',
  fetch: 'fetch',
  ball: 'fetch',
  speak: 'speak',
  bark: 'speak',
  woof: 'speak',
  talk: 'speak',
  good: 'good_boy',
  jump: 'jump',
  hop: 'jump',
  leap: 'jump',
  trick: 'play_trick',
  tricks: 'play_trick'
}
// "go get it", "get the ball": a plain "get" (as in "get lost") is nothing.
const GET_OBJECT = new Set(['it', 'the', 'that', 'ball', 'stick', 'toy'])

/** The command in this text, or null. Never throws. */
export function parseCommand(text: string): CommandName | null {
  const words = String(text)
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w === 'get' && GET_OBJECT.has(words[i + 1] ?? '')) return 'fetch'
    if (w === 'say' && words[i + 1] === 'something') return 'speak'
    const hit = WORDS[w]
    if (hit) return hit
  }
  return null
}
