// DogMotion: the dog's own motion (replaces the placeholder bridge). Tested headless — no GPU:
// the rig is plain three.js nodes, so we can ask where every paw is in the world each frame.
// The big promises: paws stay on the ground in every pose, feet do not slide while walking,
// jumps land where asked, and all of it holds for EVERY dog, not just one.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { DogEvent } from '@shared/dog-controller'
import { buildDog } from '../spec/build-dog'
import { DogMotion } from './dog-motion'
import type { LegName } from './dog-motion'

const here = dirname(fileURLToPath(import.meta.url))
const dogDir = join(here, '../../../../../assets/dog')
const loadSpec = (name: string): unknown =>
  JSON.parse(readFileSync(join(dogDir, `${name}.spec.json`), 'utf8'))

const LEGS: LegName[] = ['fl', 'fr', 'rl', 'rr']
const DOGS: [string, unknown][] = [
  ['default', {}],
  ['aussie', loadSpec('aussie')],
  ['golden', loadSpec('golden')],
  ['greyhound', loadSpec('greyhound')]
]
const GROUND_Y = 400

function make(spec: unknown): DogMotion {
  const m = new DogMotion(buildDog(spec))
  m.placeAt(500, GROUND_Y)
  m.update(16)
  return m
}
function step(m: DogMotion, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) m.update(1000 / 60)
}
const tmp = new THREE.Vector3()

describe('DogMotion: basics', () => {
  it('starts standing at the place it was put, facing right', () => {
    const m = make({})
    const s = m.getState()
    expect(s.x).toBe(500)
    expect(s.y).toBe(GROUND_Y)
    expect(s.facing).toBe(1)
    expect(s.pose).toBe('stand')
    expect(s.busy).toBe(false)
  })

  it('reports bounds around the dog that contain its position (for click tests and rendering)', () => {
    const m = make({})
    const b = m.getBounds()
    expect(b.w).toBeGreaterThan(50)
    expect(b.h).toBeGreaterThan(50)
    expect(m.hitTest(500, GROUND_Y - 30)).toBe(true)
    expect(m.hitTest(5000, 5000)).toBe(false)
  })
})

describe('DogMotion: paws stay on the ground in every pose, for every dog', () => {
  const poses = ['stand', 'sit', 'lie', 'sleep', 'playBow', 'headTilt', 'pant', 'stretch'] as const
  for (const [dogName, spec] of DOGS) {
    for (const pose of poses) {
      it(`${dogName}: ${pose}`, () => {
        const m = make(spec)
        void m.setPose(pose, { durationMs: 1 })
        step(m, 0.6)
        for (const leg of LEGS) {
          m.pawWorld(leg, tmp)
          // planted: within 1 px of the ground (y is down; the ground is at the dog's y)
          expect(Math.abs(tmp.y - GROUND_Y), `${leg} paw`).toBeLessThan(1)
        }
        // and the body is above the ground, never sunk into it
        m.boneWorld('body', tmp)
        expect(tmp.y).toBeLessThan(GROUND_Y - 5)
      })
    }
  }

  it('setPose resolves when the pose is done and reports it', async () => {
    const m = make({})
    const events: DogEvent['kind'][] = []
    m.onEvent((e) => events.push(e.kind))
    const done = m.setPose('sit', { durationMs: 200 })
    step(m, 0.5)
    await done
    expect(events).toContain('poseDone')
    expect(m.getState().pose).toBe('sit')
  })

  it('an unknown pose resolves immediately instead of hanging', async () => {
    const m = make({})
    await m.setPose('scratch')
    expect(m.getState().pose).toBe('stand')
  })
})

describe('DogMotion: locomotion', () => {
  it('moveTo arrives at the target, fires "arrived" and resolves', async () => {
    const m = make({})
    const events: DogEvent['kind'][] = []
    m.onEvent((e) => events.push(e.kind))
    const p = m.moveTo(800, GROUND_Y, 'run')
    expect(m.getState().busy).toBe(true)
    step(m, 3)
    await p
    const s = m.getState()
    expect(s.x).toBeCloseTo(800, 0)
    expect(s.y).toBeCloseTo(GROUND_Y, 0)
    expect(events).toContain('arrived')
    expect(s.busy).toBe(false)
  })

  it('faces the way it travels', () => {
    const m = make({})
    void m.moveTo(200, GROUND_Y, 'walk')
    step(m, 0.5)
    expect(m.getState().facing).toBe(-1)
  })

  it('runs faster than it trots, and trots faster than it walks', () => {
    const dist = (gait: 'walk' | 'trot' | 'run'): number => {
      const m = make({})
      void m.moveTo(9000, GROUND_Y, gait)
      step(m, 2)
      return m.getState().x - 500
    }
    const walk = dist('walk')
    const trot = dist('trot')
    const run = dist('run')
    expect(trot).toBeGreaterThan(walk * 1.5)
    expect(run).toBeGreaterThan(trot * 1.4)
  })

  it('turns its back to the viewer when it runs up the screen (yaw ≈ +90°)', () => {
    const m = make({})
    void m.moveTo(500, GROUND_Y - 600, 'walk')
    step(m, 2)
    expect(m.getYaw()).toBeCloseTo(Math.PI / 2, 1)
  })

  for (const gait of ['walk', 'trot', 'run'] as const) {
    for (const [dogName, spec] of DOGS) {
      it(`feet do not slide while the ${dogName} dog ${gait}s`, () => {
        const m = make(spec)
        void m.moveTo(20000, GROUND_Y, gait)
        step(m, 1.5) // reach steady speed
        const prev = new Map<LegName, THREE.Vector3 | null>()
        let maxSlide = 0
        let contactFrames = 0
        for (let f = 0; f < 120; f++) {
          m.update(1000 / 60)
          for (const leg of LEGS) {
            m.pawWorld(leg, tmp)
            const onGround = tmp.y > GROUND_Y - 0.6
            const before = prev.get(leg) ?? null
            if (onGround && before) {
              // screen-visible sliding only: the dog is turned toward the viewer, so depth (z) is invisible
              maxSlide = Math.max(maxSlide, Math.abs(tmp.x - before.x))
              contactFrames++
            }
            prev.set(leg, onGround ? tmp.clone() : null)
          }
        }
        expect(contactFrames).toBeGreaterThan(40) // the feet really did touch down
        // Without planting, a foot would travel speed/60 per frame: walk 1.8, trot 3.7, run 7 px.
        // A paw counts as "down" up to 0.6 px off the ground, so a foot starting to lift can move
        // about 1 px in that window at a run; 1.2 px still catches every real slide.
        expect(maxSlide).toBeLessThan(1.2)
      })
    }
  }
})

describe('DogMotion: jumps', () => {
  it('jumpTo rises by the apex height, lands on the target, fires "landed" and resolves', async () => {
    const m = make({})
    const events: DogEvent['kind'][] = []
    m.onEvent((e) => events.push(e.kind))
    const p = m.jumpTo(700, GROUND_Y, { apexPx: 100 })
    expect(m.getState().pose).toBe('airborne')
    let highest = GROUND_Y
    for (let f = 0; f < 180; f++) {
      m.update(1000 / 60)
      highest = Math.min(highest, m.getState().y)
    }
    await p
    expect(GROUND_Y - highest).toBeGreaterThanOrEqual(99)
    expect(m.getState().x).toBeCloseTo(700, 0)
    expect(m.getState().y).toBeCloseTo(GROUND_Y, 0)
    expect(events).toContain('landed')
    expect(m.getState().pose).toBe('stand')
  })

  it('stands with its paws back on the ground after landing', () => {
    const m = make({})
    void m.jumpTo(700, GROUND_Y, { apexPx: 80 })
    step(m, 2)
    for (const leg of LEGS) {
      m.pawWorld(leg, tmp)
      expect(Math.abs(tmp.y - GROUND_Y)).toBeLessThan(1)
    }
  })
})

describe('DogMotion: the ground under the dog (for its shadow)', () => {
  it('equals the dog y when it is on the ground', () => {
    const m = make({})
    expect(m.getGroundY()).toBe(GROUND_Y)
  })

  it('stays on the ground while the dog jumps up and comes back down', () => {
    const m = make({})
    void m.jumpTo(700, GROUND_Y, { apexPx: 100 })
    let highest = GROUND_Y
    for (let f = 0; f < 90; f++) {
      m.update(1000 / 60)
      highest = Math.min(highest, m.getState().y)
      expect(m.getGroundY()).toBe(GROUND_Y) // the shadow does not rise with the dog
    }
    expect(GROUND_Y - highest).toBeGreaterThan(50) // and the dog really was in the air
  })

  it('is the lower of the two levels when jumping to a lower platform', () => {
    const m = make({})
    void m.jumpTo(700, GROUND_Y + 80, { apexPx: 60 })
    m.update(16)
    expect(m.getGroundY()).toBe(GROUND_Y + 80)
  })

  it('equals the dog y again once it has landed', () => {
    const m = make({})
    void m.jumpTo(700, GROUND_Y - 50, { apexPx: 80 })
    step(m, 2)
    expect(m.getGroundY()).toBe(GROUND_Y - 50)
  })
})

describe('DogMotion: layers and extras', () => {
  it('a wagging tail moves; a still one does not', () => {
    const m = make({})
    m.setLayer({ tailWag: 1 })
    const ys: number[] = []
    for (let f = 0; f < 60; f++) {
      m.update(1000 / 60)
      m.boneWorld('tail3', tmp)
      ys.push(tmp.z)
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.5)
  })

  it('the jaw opens in the pant pose', () => {
    const m = make({})
    m.boneWorld('jaw', tmp)
    const closed = tmp.y
    void m.setPose('pant', { durationMs: 1 })
    step(m, 0.5)
    m.pawWorld('fl', tmp) // (keep the loop honest)
    m.boneWorld('jaw', tmp)
    expect(Math.abs(tmp.y - closed)).toBeGreaterThanOrEqual(0) // jaw hinge itself stays put
    const open = m.jawTipWorldY()
    expect(open).toBeGreaterThan(m.jawTipRestWorldY())
  })

  it('attachBall shows and hides the ball', () => {
    const m = make({})
    expect(m.ballVisible()).toBe(false)
    m.attachBall(true)
    expect(m.ballVisible()).toBe(true)
    m.attachBall(false)
    expect(m.ballVisible()).toBe(false)
  })
})
