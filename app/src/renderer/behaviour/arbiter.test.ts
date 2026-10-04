// Arbiter (P2 Task 4): the traffic cop. Only one thing controls the dog at a time. Order:
// fetch > your commands > the welcome-back greeting > ordinary reactions > nothing. A higher one
// interrupts a lower one; a lower one waits; among equals a higher priority interrupts only after
// the current one has been held for its minimum time. It also decides where the dog looks.
import { describe, expect, it } from 'vitest'
import { Arbiter, chooseLook } from './arbiter'

describe('Arbiter ownership', () => {
  it('starts with nobody in charge, and the first request is granted', () => {
    const a = new Arbiter()
    expect(a.owner).toBe('none')
    expect(a.request('reaction', 'idle', 1, 0)).toBe(true)
    expect(a.owner).toBe('reaction')
    expect(a.id).toBe('idle')
  })

  it('a higher rank interrupts a lower one, and the loser is told', () => {
    const a = new Arbiter()
    const lost: string[] = []
    a.onPreempt((id) => lost.push(id))
    a.request('reaction', 'typing', 2, 0)
    expect(a.request('fetch', 'fetch', 0, 0)).toBe(true)
    expect(lost).toEqual(['typing'])
    expect(a.owner).toBe('fetch')
  })

  it('a lower rank never interrupts a higher one', () => {
    const a = new Arbiter()
    a.request('fetch', 'fetch', 0, 0)
    expect(a.request('reaction', 'sleep', 9, 0)).toBe(false)
    expect(a.request('greet', 'greet', 9, 0)).toBe(false)
    expect(a.request('command', 'pet', 9, 0)).toBe(false)
    expect(a.owner).toBe('fetch')
  })

  it('the order is fetch > command > greet > reaction', () => {
    const order = ['reaction', 'greet', 'command', 'fetch'] as const
    for (let hi = 1; hi < order.length; hi++) {
      for (let lo = 0; lo < hi; lo++) {
        const a = new Arbiter()
        a.request(order[lo]!, 'low', 1, 0)
        expect(a.request(order[hi]!, 'high', 1, 0)).toBe(true)
        const b = new Arbiter()
        b.request(order[hi]!, 'high', 1, 0)
        expect(b.request(order[lo]!, 'low', 1, 0)).toBe(false)
      }
    }
  })

  it('among equals, a higher priority interrupts only after the minimum hold time', () => {
    const a = new Arbiter()
    a.request('reaction', 'typing', 2, 1500)
    expect(a.request('reaction', 'backspace', 6, 0)).toBe(false) // too soon
    a.update(1000)
    expect(a.request('reaction', 'backspace', 6, 0)).toBe(false)
    a.update(500)
    expect(a.request('reaction', 'backspace', 6, 0)).toBe(true)
    expect(a.id).toBe('backspace')
  })

  it('among equals, the same or a lower priority never interrupts', () => {
    const a = new Arbiter()
    a.request('reaction', 'typing', 3, 0)
    a.update(10000)
    expect(a.request('reaction', 'idle', 3, 0)).toBe(false)
    expect(a.request('reaction', 'idle', 1, 0)).toBe(false)
  })

  it('the same owner asking again is just a yes (no preempt callback)', () => {
    const a = new Arbiter()
    const lost: string[] = []
    a.onPreempt((id) => lost.push(id))
    a.request('reaction', 'typing', 2, 0)
    expect(a.request('reaction', 'typing', 2, 0)).toBe(true)
    expect(lost).toEqual([])
  })

  it('release frees the dog for anyone, but only the current owner can release it', () => {
    const a = new Arbiter()
    a.request('reaction', 'typing', 2, 0)
    a.release('someone-else')
    expect(a.owner).toBe('reaction')
    a.release('typing')
    expect(a.owner).toBe('none')
    expect(a.request('reaction', 'idle', 1, 0)).toBe(true)
  })

  it('tracks how long the current owner has held the dog', () => {
    const a = new Arbiter()
    a.request('reaction', 'idle', 1, 0)
    a.update(250)
    a.update(250)
    expect(a.heldMs).toBe(500)
    a.release('idle')
    expect(a.heldMs).toBe(0)
  })

  it('ignores non-finite time', () => {
    const a = new Arbiter()
    a.request('reaction', 'idle', 1, 0)
    a.update(Number.NaN)
    a.update(-5)
    expect(a.heldMs).toBe(0)
  })
})

describe('chooseLook (who the dog looks at)', () => {
  it('the ball beats the cursor', () => {
    expect(chooseLook({ ballWatched: true, cursorAgeMs: 100 })).toBe('ball')
  })
  it('the cursor, while it has moved in the last 3 seconds', () => {
    expect(chooseLook({ ballWatched: false, cursorAgeMs: 2999 })).toBe('cursor')
    expect(chooseLook({ ballWatched: false, cursorAgeMs: 3000 })).toBe('none')
  })
  it('otherwise nothing (the dog does its own lazy look-around)', () => {
    expect(chooseLook({ ballWatched: false, cursorAgeMs: Number.POSITIVE_INFINITY })).toBe('none')
  })
})
