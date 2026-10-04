// Commands (P3 serial, phase D1): the fixed command list. Text (typed, spoken, or the name Gemini
// picked) becomes one of seven actions, or null when it is not a command. Forgiving about wording,
// strict about whole words ("situation" is not "sit").
import { describe, expect, it } from 'vitest'
import { COMMAND_LABELS, COMMAND_NAMES, parseCommand } from './commands'

describe('the seven commands', () => {
  const cases: [string, string][] = [
    ['sit', 'sit'],
    ['Sit down', 'sit'],
    ['SIT!', 'sit'],
    ['please sit', 'sit'],
    ['lie down', 'lie_down'],
    ['lay down', 'lie_down'],
    ['down', 'lie_down'],
    ['lie', 'lie_down'],
    ['come', 'come'],
    ['come here!', 'come'],
    ['here boy', 'come'],
    ['come on', 'come'],
    ['fetch', 'fetch'],
    ['go get it', 'fetch'],
    ['get the ball', 'fetch'],
    ['play ball', 'fetch'],
    ['speak', 'speak'],
    ['bark', 'speak'],
    ['say something', 'speak'],
    ['woof', 'speak'],
    ['good boy', 'good_boy'],
    ['Good girl!', 'good_boy'],
    ['who is a good dog', 'good_boy'],
    ['good job', 'good_boy'],
    ['show me a trick', 'play_trick'],
    ['do a trick', 'play_trick'],
    ['trick', 'play_trick']
  ]
  for (const [text, want] of cases) {
    it(`"${text}" -> ${want}`, () => expect(parseCommand(text)).toBe(want))
  }
})

describe('what is not a command', () => {
  for (const text of [
    '',
    '   ',
    'hello there',
    'what time is it',
    'situation',
    'comet',
    'downtown',
    'fetching',
    '???',
    'go'
  ]) {
    it(`"${text}" -> null`, () => expect(parseCommand(text)).toBeNull())
  }
})

describe('wording', () => {
  it('the first command word wins ("come and sit" is come, "sit and come" is sit)', () => {
    expect(parseCommand('come and sit')).toBe('come')
    expect(parseCommand('sit and come')).toBe('sit')
  })
  it('"sit down" is sit, not lie down', () => {
    expect(parseCommand('sit down')).toBe('sit')
  })
  it('punctuation, case and extra spaces do not matter', () => {
    expect(parseCommand('  LiE,   DoWn... ')).toBe('lie_down')
  })
  it('every command name round-trips (Gemini sends the tool name as the text)', () => {
    for (const n of COMMAND_NAMES) expect(parseCommand(n)).toBe(n)
  })
  it('a plain "get" is not fetch', () => {
    expect(parseCommand('get lost')).toBeNull()
  })
})

describe('junk', () => {
  it('never throws and only returns a known name or null (5,000 random strings)', () => {
    let seed = 11
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const words = [
      'sit',
      'down',
      'come',
      'get',
      'it',
      'good',
      'boy',
      'x',
      '!',
      '_',
      'trick',
      'ball',
      '\n',
      ''
    ]
    for (let i = 0; i < 5000; i++) {
      let s = ''
      for (let k = Math.floor(rand() * 6); k > 0; k--)
        s += words[Math.floor(rand() * words.length)] + (rand() < 0.5 ? ' ' : '')
      const r = parseCommand(s)
      expect(r === null || (COMMAND_NAMES as readonly string[]).includes(r)).toBe(true)
    }
    expect(parseCommand('\u0000￿💥')).toBeNull()
  })
})

describe('button labels', () => {
  it('every command has a label, and pressing a label gives back its own command', () => {
    for (const n of COMMAND_NAMES) {
      expect(COMMAND_LABELS[n].length).toBeGreaterThan(0)
      expect(parseCommand(COMMAND_LABELS[n])).toBe(n)
    }
  })
})
