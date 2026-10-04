// The pet hand (white cartoon glove) as three.js shapes: placed at the dog's head, scaled with the dog,
// shown only while a petting plays. No GPU needed: only the scene graph is checked.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { HAND, createHandPose, handPoseAt } from './hand-motion'
import { PetHand } from './hand-view'

const ANCHOR = { x: 400, y: 300 }

describe('PetHand', () => {
  it('is added to the scene but hidden until a petting plays', () => {
    const scene = new THREE.Scene()
    const hand = new PetHand(scene)
    expect(scene.children).toContain(hand.group)
    expect(hand.group.visible).toBe(false)
    hand.update(16, ANCHOR, 100)
    expect(hand.group.visible).toBe(false)
    expect(hand.playing).toBe(false)
  })

  it("plays: visible, placed relative to the head and scaled by the dog's height", () => {
    const hand = new PetHand(new THREE.Scene())
    hand.play()
    hand.update(HAND.enterMs + 100, ANCHOR, 200)
    const pose = handPoseAt(HAND.enterMs + 100, createHandPose())
    expect(hand.playing).toBe(true)
    expect(hand.group.visible).toBe(true)
    expect(hand.group.position.x).toBeCloseTo(ANCHOR.x + pose.x * 200, 4)
    expect(hand.group.position.y).toBeCloseTo(ANCHOR.y + pose.y * 200, 4)
    expect(hand.group.scale.x).toBeCloseTo(200, 6)
    expect(hand.group.rotation.z).toBeCloseTo(pose.rot, 6)
  })

  it('a bigger dog gets a bigger hand, moving over a bigger distance', () => {
    const small = new PetHand(new THREE.Scene())
    const big = new PetHand(new THREE.Scene())
    for (const h of [small, big]) h.play()
    small.update(HAND.enterMs, ANCHOR, 100)
    big.update(HAND.enterMs, ANCHOR, 200)
    const dySmall = ANCHOR.y - small.group.position.y
    const dyBig = ANCHOR.y - big.group.position.y
    expect(dyBig).toBeCloseTo(2 * dySmall, 4)
  })

  it('it is drawn on top of everything (never hidden behind the dog or its fur)', () => {
    const hand = new PetHand(new THREE.Scene())
    hand.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        expect(o.renderOrder).toBeGreaterThanOrEqual(7)
        const m = o.material as THREE.Material
        expect(m.depthTest).toBe(false)
        expect(m.depthWrite).toBe(false)
        expect(m.transparent).toBe(true)
      }
    })
  })

  it('has a palm, four fingers, a thumb, a cuff and a sleeve, each with an outline (white glove, dark edge)', () => {
    const hand = new PetHand(new THREE.Scene())
    let meshes = 0
    hand.group.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes++
    })
    expect(meshes).toBeGreaterThanOrEqual(16) // (palm + 4 fingers + thumb + cuff + sleeve) x (fill + outline)
  })

  it("fades with the motion: opacity follows the pose's alpha", () => {
    const hand = new PetHand(new THREE.Scene())
    hand.play()
    hand.update(HAND.enterMs * 0.5, ANCHOR, 100)
    const opacities: number[] = []
    hand.group.traverse((o) => {
      if (o instanceof THREE.Mesh) opacities.push((o.material as THREE.Material).opacity)
    })
    expect(Math.max(...opacities)).toBeCloseTo(0.5, 2)
    hand.update(HAND.enterMs, ANCHOR, 100)
    hand.group.traverse((o) => {
      if (o instanceof THREE.Mesh)
        expect((o.material as THREE.Material).opacity).toBeGreaterThan(0.9)
    })
  })

  it('goes away by itself when the petting is over', () => {
    const hand = new PetHand(new THREE.Scene())
    hand.play()
    hand.update(HAND.durationMs + 10, ANCHOR, 100)
    expect(hand.playing).toBe(false)
    expect(hand.group.visible).toBe(false)
  })

  it('playing again restarts the petting from the beginning (no stacking, no extra shapes)', () => {
    const scene = new THREE.Scene()
    const hand = new PetHand(scene)
    hand.play()
    hand.update(1500, ANCHOR, 100)
    const children = hand.group.children.length
    hand.play()
    hand.update(10, ANCHOR, 100)
    expect(hand.group.children.length).toBe(children)
    expect(scene.children.length).toBe(1)
    const start = handPoseAt(10, createHandPose())
    expect(hand.group.position.y).toBeCloseTo(ANCHOR.y + start.y * 100, 4)
  })

  it('ignores garbage (NaN time, NaN anchor, zero size) without breaking', () => {
    const hand = new PetHand(new THREE.Scene())
    hand.play()
    hand.update(Number.NaN, ANCHOR, 100)
    hand.update(16, { x: Number.NaN, y: Number.NaN }, 100)
    hand.update(16, ANCHOR, 0)
    expect(Number.isFinite(hand.group.position.x) || !hand.group.visible).toBe(true)
  })

  it('dispose removes it from the scene and frees its shapes', () => {
    const scene = new THREE.Scene()
    const hand = new PetHand(scene)
    hand.dispose()
    expect(scene.children).not.toContain(hand.group)
    expect(hand.group.children.length).toBe(0)
  })
})
