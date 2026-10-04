// Controller mapper (P3 serial, phase A): turns the Arduino's raw messages (joystick position,
// button, touch; contract §3.7) into the app's InputEvents (contract §3.6), the same events the mouse
// slingshot makes. Pure logic with the time passed in: no serial port, no clock of its own.
//
//   joystick: works like a slingshot. Pull it back and the ball flies the OPPOSITE way; the pull
//             past 25% sends `aim`; letting go (back under 15%) after a pull of at least 35% sends
//             `launch` with the strongest pull. Pressing the button while aiming throws at once.
//   button:   a tap (under 0.4 s) is `call`; a hold is `pushToTalk` (start at 0.4 s, stop on release).
//   touch:    `pet`, once per touch.
// The stick's centre is its first reading (or 512 if that does not look like rest). Which way is
// "pulled back" depends on how the joystick is mounted: `invertX`, `invertY` and `swapXY` fix that
// once on the real hardware.
import type { InputEvent } from '@shared/input'
import type { ArduinoMessage } from '@shared/serial'

export const MAPPER = {
  /** The stick reads 0..1023 around a middle of about 512: this is half the range. */
  halfRange: 512,
  /** A first reading within this of 512 is taken as the stick at rest (its centre). */
  restWindow: 60,
  /** A pull of at least this (0..1) starts aiming. */
  aimStart: 0.25,
  /** The strongest pull of an aim must reach this for letting go to throw. */
  launchMin: 0.35,
  /** Back under this counts as let go. */
  releaseBelow: 0.15,
  /** A button press shorter than this is a tap (call); longer is a hold (push-to-talk). */
  tapMaxMs: 400,
  /** A stick held pulled this long is given up on (no throw). */
  aimTimeoutMs: 8000,
  /** Touches closer together than this are one pet. */
  petGapMs: 1000
}

export interface MapperConfig {
  invertX: boolean
  invertY: boolean
  swapXY: boolean
}

type Emit = (e: InputEvent) => void

export class ControllerMapper {
  private readonly cfg: MapperConfig
  private cx: number | null = null
  private cy: number | null = null

  private aiming = false
  private aimStartedAt = 0
  private peakPower = 0
  private peakAngle = 0
  private curPower = 0
  private curAngle = 0
  /** After a throw (or a timeout) the stick must come back to the middle before a new aim can start. */
  private locked = false

  private buttonDown = false
  private buttonDownAt = 0
  private consumed = false
  private talking = false

  private lastPetAt = Number.NEGATIVE_INFINITY

  constructor(cfg: Partial<MapperConfig> = {}) {
    this.cfg = { invertX: false, invertY: false, swapXY: false, ...cfg }
  }

  /** One parsed message from the Arduino. */
  feed(msg: ArduinoMessage, nowMs: number, emit: Emit): void {
    if (msg.kind === 'joystick') this.joystick(msg.x, msg.y, nowMs, emit)
    else if (msg.kind === 'button') this.button(msg.down, nowMs, emit)
    else if (msg.kind === 'touch') this.touch(msg.down, nowMs, emit)
    // 'hello' (it repeats every 2 s forever) tells us nothing new
  }

  /** Time passing with no messages (the reader calls this every ~50 ms): holds and timeouts. */
  tick(nowMs: number, emit: Emit): void {
    this.checkAimTimeout(nowMs)
    if (
      this.buttonDown &&
      !this.consumed &&
      !this.talking &&
      nowMs - this.buttonDownAt >= MAPPER.tapMaxMs
    ) {
      this.talking = true
      emit({ kind: 'pushToTalk', state: 'start' })
    }
  }

  /** The board went away (unplugged) or was replugged: forget everything, and end any push-to-talk. */
  reset(emit: Emit): void {
    if (this.talking) emit({ kind: 'pushToTalk', state: 'stop' })
    this.talking = false
    this.buttonDown = false
    this.consumed = false
    this.aiming = false
    this.locked = false
    this.cx = null
    this.cy = null
  }

  // ---- the stick ---------------------------------------------------------------------------

  private joystick(rawX: number, rawY: number, now: number, emit: Emit): void {
    this.checkAimTimeout(now)
    const sx = this.cfg.swapXY ? rawY : rawX
    const sy = this.cfg.swapXY ? rawX : rawY
    if (this.cx === null || this.cy === null) {
      const rest =
        Math.abs(sx - 512) <= MAPPER.restWindow && Math.abs(sy - 512) <= MAPPER.restWindow
      this.cx = rest ? sx : 512
      this.cy = rest ? sy : 512
    }
    const dx = ((sx - this.cx) / MAPPER.halfRange) * (this.cfg.invertX ? -1 : 1)
    const dy = ((sy - this.cy) / MAPPER.halfRange) * (this.cfg.invertY ? -1 : 1)
    const power = Math.min(1, Math.hypot(dx, dy))
    // like the mouse slingshot: the ball flies from the stick position back toward the centre
    const angle = Math.atan2(-dy, -dx)

    if (this.locked) {
      if (power < MAPPER.releaseBelow) this.locked = false
      return
    }
    if (!this.aiming) {
      if (power < MAPPER.aimStart) return
      this.aiming = true
      this.aimStartedAt = now
      this.peakPower = power
      this.peakAngle = angle
    } else if (power < MAPPER.releaseBelow) {
      this.aiming = false
      if (this.peakPower >= MAPPER.launchMin) {
        emit({ kind: 'launch', angle: this.peakAngle, power: this.peakPower })
      }
      return
    } else if (power > this.peakPower) {
      this.peakPower = power
      this.peakAngle = angle
    }
    this.curPower = power
    this.curAngle = angle
    emit({ kind: 'aim', angle, power })
  }

  private checkAimTimeout(now: number): void {
    if (this.aiming && now - this.aimStartedAt >= MAPPER.aimTimeoutMs) {
      this.aiming = false
      this.locked = true
    }
  }

  // ---- the button --------------------------------------------------------------------------

  private button(down: boolean, now: number, emit: Emit): void {
    if (down) {
      if (this.buttonDown) return
      this.buttonDown = true
      this.buttonDownAt = now
      this.consumed = false
      if (this.aiming && this.curPower >= MAPPER.aimStart) {
        // pressed while really aiming: throw right now with the current aim, and this press is used up
        emit({ kind: 'launch', angle: this.curAngle, power: this.curPower })
        this.aiming = false
        this.locked = true
        this.consumed = true
      }
      return
    }
    if (!this.buttonDown) return
    this.buttonDown = false
    if (this.talking) {
      this.talking = false
      emit({ kind: 'pushToTalk', state: 'stop' })
    } else if (!this.consumed) {
      if (now - this.buttonDownAt < MAPPER.tapMaxMs) {
        emit({ kind: 'call' })
      } else {
        // held long enough to be a hold, but no tick came in between: start and stop it now
        emit({ kind: 'pushToTalk', state: 'start' })
        emit({ kind: 'pushToTalk', state: 'stop' })
      }
    }
  }

  // ---- the touch sensor ----------------------------------------------------------------------

  private touch(down: boolean, now: number, emit: Emit): void {
    if (!down || now - this.lastPetAt < MAPPER.petGapMs) return
    this.lastPetAt = now
    emit({ kind: 'pet', source: 'touch' })
  }
}
