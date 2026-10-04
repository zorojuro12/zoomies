// Click-through hold gate (Task 3 of a-p1-overlay.md): starts click-through (clicks pass to
// whatever's underneath); goes interactive immediately when the cursor is over the dog/ball; waits
// `holdMs` of continuous non-interactive time before going back, so a moving cursor crossing the
// dog's edge doesn't flicker click-through state every frame.
export class ClickThroughGate {
  private readonly holdMs: number
  private state: 'interactive' | 'clickThrough' = 'clickThrough'
  private falseSinceMs: number | null = null

  constructor(holdMs = 150) {
    this.holdMs = holdMs
  }

  update(nowMs: number, overInteractive: boolean): 'interactive' | 'clickThrough' | null {
    if (overInteractive) {
      this.falseSinceMs = null
      if (this.state !== 'interactive') {
        this.state = 'interactive'
        return 'interactive'
      }
      return null
    }

    if (this.state === 'clickThrough') return null

    if (this.falseSinceMs === null) this.falseSinceMs = nowMs
    if (nowMs - this.falseSinceMs >= this.holdMs) {
      this.state = 'clickThrough'
      this.falseSinceMs = null
      return 'clickThrough'
    }
    return null
  }
}
