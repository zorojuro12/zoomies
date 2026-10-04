// Reactions (P2 Task 4 of docs/plans/a-p2-mvp-behaviour.md): the table of "when this happens, the
// dog does that" (PRD §4.3 and §4.4). Each reaction says when it may start (`eligible`), what it
// does (`start`), what it keeps doing while it has the dog (`update`, false = finished) and how it
// tidies up (`stop`, also called when a more important thing takes the dog). Which one runs, and
// when, is the Arbiter's and the Behaviour's job; the reactions only act on the dog.
import type { DogController } from '@shared/dog-controller'
import type { Needs } from './needs'
import { wants } from './needs'
import type { UserState } from './activity'
import type { DogExtras } from './dog-extras'
import type { FpsTier } from './fps'

export interface Ctx {
  clockMs: number
  user: UserState
  backspaceSpam: boolean
  lateNight: boolean
  keysPerSec: number
  needs: Needs
  dogX: number
  /** Centre of the topmost window, clamped onto the screen; NaN when there is none. */
  windowX: number
  cursorX: number
  /** Milliseconds the cursor has been over the dog (with a short grace when it slips off). */
  cursorOverMs: number
  /** Milliseconds the cursor has been moving fast (above 2500 px/s). */
  cursorFastMs: number
  /** The user just came back from sleep and has not been greeted yet. */
  returnedPending: boolean
  screenW: number
}

export interface Env {
  dog: DogController
  extras: DogExtras
  /** True once the dog has arrived at its last moveTo (reactions clear it when they send it somewhere). */
  arrived: boolean
}

export interface Reaction {
  id: string
  rank: 'reaction' | 'greet'
  /** Among reactions that could start, the highest wins. */
  priority: number
  /** After starting, it may not start again for this long. */
  cooldownMs: number
  /** Nothing of the same rank may interrupt it for this long. */
  minHoldMs: number
  /** What the needs model should think the dog is doing meanwhile. */
  doing: 'active' | 'resting' | 'sleeping'
  /** How often it needs redrawing once it has settled in (see fps.ts). */
  fps: FpsTier
  /** False while it is still moving into place (it is drawn at full speed until then). */
  settled?(): boolean
  eligible(c: Ctx): boolean
  start(c: Ctx, e: Env): void
  update(dtMs: number, c: Ctx, e: Env): boolean
  stop(e: Env): void
}

const EDGE = 20
const clampX = (x: number, w: number): number => Math.min(Math.max(x, EDGE), w - EDGE)

function stand(e: Env): void {
  void e.dog.setPose('stand')
  e.extras.setMood('neutral', 0)
}

// ---- idle and sleep -------------------------------------------------------------------------

const idle: Reaction = {
  id: 'idle',
  rank: 'reaction',
  priority: 1,
  cooldownMs: 0,
  minHoldMs: 0,
  doing: 'active',
  fps: 'rest',
  eligible: (c) => c.user === 'idle',
  start(c, e) {
    void e.dog.setPose('sit')
    e.extras.setMood('sleepy', c.lateNight ? 0.7 : 0.4)
  },
  update: (_dt, c) => c.user === 'idle',
  stop: stand
}

const sleep: Reaction = {
  id: 'sleep',
  rank: 'reaction',
  priority: 1,
  cooldownMs: 0,
  minHoldMs: 0,
  doing: 'sleeping',
  fps: 'sleep',
  eligible: (c) => c.user === 'asleep',
  start(_c, e) {
    void e.dog.setPose('sleep')
    e.extras.setMood('sleepy', 1)
  },
  update: (_dt, c) => c.user === 'asleep',
  stop: stand
}

// ---- the welcome back -----------------------------------------------------------------------

const greet = ((): Reaction => {
  let t = 0
  let stage = 0
  return {
    id: 'greet',
    rank: 'greet',
    priority: 5,
    cooldownMs: 0,
    minHoldMs: 3000,
    doing: 'active',
    fps: 'full',
    eligible: (c) => c.returnedPending,
    start(_c, e) {
      t = 0
      stage = 0
      void e.dog.setPose('stretch')
    },
    update(dt, c, e) {
      t += dt
      if (stage === 0 && t >= 1000) {
        stage = 1
        void e.dog.setPose('stand')
      } else if (stage === 1 && t >= 1300) {
        stage = 2
        void e.extras.playIdle('yawn')
      } else if (stage === 2 && t >= 2800) {
        stage = 3
        e.arrived = false
        e.extras.setMood('happy', 1)
        void e.dog.moveTo(clampX(c.cursorX, c.screenW), e.dog.getState().y, 'trot')
      }
      return stage < 3 ? true : !e.arrived && t < 12000
    },
    stop: stand
  }
})()

// ---- typing ---------------------------------------------------------------------------------

/** Lie down on the floor below the active window (or right here if there is none). */
function lieBeside(id: 'typing' | 'focus', doze: boolean): Reaction {
  let lying = false
  let lastEars = -1
  return {
    id,
    rank: 'reaction',
    priority: doze ? 3 : 2,
    cooldownMs: 0,
    minHoldMs: 1500,
    doing: 'resting',
    fps: 'rest',
    settled: () => lying,
    eligible: (c) => c.user === id,
    start(c, e) {
      lying = false
      lastEars = -1
      e.arrived = false
      const x = Number.isFinite(c.windowX) ? c.windowX : c.dogX
      if (Math.abs(x - c.dogX) > 40) void e.dog.moveTo(x, e.dog.getState().y, 'walk')
      else e.arrived = true
      if (doze) {
        e.extras.setMood('sleepy', 0.6)
        e.dog.setLayer({ breathing: 0.7 })
      }
    },
    update(_dt, c, e) {
      if (!lying && e.arrived) {
        lying = true
        void e.dog.setPose('lie')
      }
      // the ears twitch with the typing
      const ears = Math.min(1, c.keysPerSec / 6)
      if (Math.abs(ears - lastEars) > 0.1) {
        lastEars = ears
        e.dog.setLayer({ earPerk: ears })
      }
      return c.user === id
    },
    stop(e) {
      e.dog.setLayer({ earPerk: 0, breathing: 1 })
      stand(e)
    }
  }
}

const backspace = ((): Reaction => {
  let t = 0
  return {
    id: 'backspace',
    rank: 'reaction',
    priority: 6,
    cooldownMs: 20000,
    minHoldMs: 1500,
    doing: 'active',
    fps: 'full',
    eligible: (c) => c.backspaceSpam,
    start(_c, e) {
      t = 0
      void e.dog.setPose('headTilt')
    },
    update(dt) {
      t += dt
      return t < 1500
    },
    stop: (e) => {
      void e.dog.setPose('stand')
    }
  }
})()

// ---- tired ----------------------------------------------------------------------------------

const rest = ((): Reaction => {
  let on = false
  return {
    id: 'rest',
    rank: 'reaction',
    priority: 2,
    cooldownMs: 0,
    minHoldMs: 0,
    doing: 'resting',
    fps: 'rest',
    // worn out below 25%, and it stays down until it is back to 60%
    eligible: (c) => (on ? c.needs.energy < 0.6 : wants(c.needs).rest),
    start(_c, e) {
      on = true
      void e.dog.setPose('lie')
      e.extras.setMood('sleepy', 0.5)
    },
    update(_dt, c) {
      on = c.needs.energy < 0.6
      return on
    },
    stop(e) {
      on = false
      stand(e)
    }
  }
})()

// ---- the cursor -----------------------------------------------------------------------------

const hover: Reaction = {
  id: 'hover',
  rank: 'reaction',
  priority: 5,
  cooldownMs: 0,
  minHoldMs: 0,
  doing: 'active',
  fps: 'full',
  eligible: (c) => c.cursorOverMs >= 400,
  start(_c, e) {
    e.extras.setMood('happy', 0.8)
    e.dog.setLayer({ tailWag: 1 })
  },
  update: (_dt, c) => c.cursorOverMs > 0,
  stop(e) {
    e.dog.setLayer({ tailWag: 0.5 })
    e.extras.setMood('neutral', 0)
  }
}

const shake = ((): Reaction => {
  let t = 0
  let sent = false
  let targetX = 0
  return {
    id: 'shake',
    rank: 'reaction',
    priority: 7,
    cooldownMs: 15000,
    minHoldMs: 2500,
    doing: 'active',
    fps: 'full',
    eligible: (c) => c.cursorFastMs >= 400 && Math.abs(c.cursorX - c.dogX) > 150,
    start(c, e) {
      t = 0
      sent = false
      targetX = clampX(c.cursorX, c.screenW)
      e.arrived = false
      void e.dog.setPose('playBow')
      e.extras.setMood('happy', 1)
    },
    update(dt, _c, e) {
      t += dt
      if (!sent && t >= 600) {
        sent = true
        void e.dog.moveTo(targetX, e.dog.getState().y, 'run')
      }
      return t < 2500 || (sent && !e.arrived && t < 6000)
    },
    stop: stand
  }
})()

/** Every reaction, highest priority first. */
export function createReactions(): Reaction[] {
  return [
    shake,
    backspace,
    greet,
    hover,
    lieBeside('focus', true),
    lieBeside('typing', false),
    rest,
    idle,
    sleep
  ].sort((a, b) => b.priority - a.priority)
}
