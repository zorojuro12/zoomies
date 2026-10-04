// Arbiter (P2 Task 4 of docs/plans/a-p2-mvp-behaviour.md): the traffic cop. Only one thing controls
// the dog at a time. Order: fetch > your commands > the welcome-back greeting > ordinary reactions
// > nothing. A higher rank interrupts a lower one (the loser is told, so it can tidy up); a lower
// one waits. Among equal ranks a higher priority interrupts only once the current owner has held
// the dog for its minimum time. No allocation per call.

export type Owner = 'none' | 'reaction' | 'greet' | 'command' | 'fetch'

const RANK: Record<Owner, number> = { none: 0, reaction: 1, greet: 2, command: 3, fetch: 4 }

export class Arbiter {
  owner: Owner = 'none'
  id = ''
  /** How long the current owner has had the dog, in ms. */
  heldMs = 0

  private priority = 0
  private minHoldMs = 0
  private readonly listeners = new Set<(id: string) => void>()

  /** Called with the id of whoever just lost the dog to a higher request. */
  onPreempt(cb: (id: string) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** Ask to take the dog. True if granted (and `owner`/`id` now say so). */
  request(owner: Exclude<Owner, 'none'>, id: string, priority: number, minHoldMs: number): boolean {
    if (this.owner === owner && this.id === id) return true
    if (this.owner !== 'none') {
      const higherRank = RANK[owner] > RANK[this.owner]
      const sameRank = RANK[owner] === RANK[this.owner]
      const outranks = sameRank && priority > this.priority && this.heldMs >= this.minHoldMs
      if (!higherRank && !outranks) return false
      const lost = this.id
      this.take(owner, id, priority, minHoldMs)
      for (const cb of this.listeners) cb(lost)
      return true
    }
    this.take(owner, id, priority, minHoldMs)
    return true
  }

  /** Give the dog up (only the current owner can). */
  release(id: string): void {
    if (this.owner === 'none' || this.id !== id) return
    this.owner = 'none'
    this.id = ''
    this.heldMs = 0
    this.priority = 0
    this.minHoldMs = 0
  }

  update(dtMs: number): void {
    if (Number.isFinite(dtMs) && dtMs > 0 && this.owner !== 'none') this.heldMs += dtMs
  }

  private take(
    owner: Exclude<Owner, 'none'>,
    id: string,
    priority: number,
    minHoldMs: number
  ): void {
    this.owner = owner
    this.id = id
    this.priority = priority
    this.minHoldMs = minHoldMs
    this.heldMs = 0
  }
}

/** How recently the cursor must have moved for the dog to keep looking at it. */
export const CURSOR_LOOK_MS = 3000

/** Who the dog looks at: the ball (when a fetch is watching it), else a recently moved cursor, else nobody. */
export function chooseLook(i: {
  ballWatched: boolean
  cursorAgeMs: number
}): 'ball' | 'cursor' | 'none' {
  if (i.ballWatched) return 'ball'
  if (i.cursorAgeMs < CURSOR_LOOK_MS) return 'cursor'
  return 'none'
}
