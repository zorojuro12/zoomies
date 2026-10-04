// Debug-only outlines of the work area and world solids (Task 6 of a-p1-overlay.md), plus the
// ball mesh (Task 7) and the slingshot aim line (Task 8) — both always visible, not debug-gated.
import * as THREE from 'three'
import type { Rect } from '@shared/geometry'
import type { Ball } from './ball'

const WORK_AREA_COLOR = 0xffffff
const SOLID_COLOR = 0x00ff88
const BALL_COLOR = 0xffcc00
const AIM_LINE_COLOR = 0xff3366
const AIM_LINE_MAX_PX = 160
// Above the dog's highest renderOrder (SdfDog's debug overlay uses 5).
const BALL_RENDER_ORDER = 10
const AIM_LINE_RENDER_ORDER = 11

function makeOutline(r: Rect, color: number): THREE.Line {
  const points = [
    new THREE.Vector3(r.x, r.y, 0),
    new THREE.Vector3(r.x + r.w, r.y, 0),
    new THREE.Vector3(r.x + r.w, r.y + r.h, 0),
    new THREE.Vector3(r.x, r.y + r.h, 0),
    new THREE.Vector3(r.x, r.y, 0)
  ]
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({ color })
  return new THREE.Line(geometry, material)
}

export class WorldView {
  private readonly group = new THREE.Group()
  private readonly ballMesh: THREE.Mesh
  private readonly aimLine: THREE.Line
  private readonly aimLinePosition: THREE.BufferAttribute

  constructor(scene: THREE.Scene) {
    this.group.visible = false
    scene.add(this.group)

    const geometry = new THREE.CircleGeometry(1, 24)
    // transparent + depthTest:false puts the ball in the dog's render bucket (its SDF quad is
    // transparent) so BALL_RENDER_ORDER actually wins — see SdfDog.ts's skeleton overlay for the
    // same pattern. Plain opaque would draw in the earlier opaque pass and lose regardless of order.
    const material = new THREE.MeshBasicMaterial({
      color: BALL_COLOR,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false
    })
    this.ballMesh = new THREE.Mesh(geometry, material)
    this.ballMesh.renderOrder = BALL_RENDER_ORDER
    scene.add(this.ballMesh)

    const aimGeometry = new THREE.BufferGeometry()
    this.aimLinePosition = new THREE.BufferAttribute(new Float32Array(6), 3)
    aimGeometry.setAttribute('position', this.aimLinePosition)
    this.aimLine = new THREE.Line(
      aimGeometry,
      new THREE.LineBasicMaterial({
        color: AIM_LINE_COLOR,
        transparent: true,
        depthTest: false,
        depthWrite: false
      })
    )
    this.aimLine.renderOrder = AIM_LINE_RENDER_ORDER
    this.aimLine.visible = false
    scene.add(this.aimLine)
  }

  setDebug(on: boolean): void {
    this.group.visible = on
  }

  setBall(ball: Ball): void {
    this.ballMesh.position.set(ball.x, ball.y, 0)
    this.ballMesh.scale.setScalar(ball.r)
  }

  /** `aim` is `null` while not dragging, or below the slingshot's minimum pull distance. */
  setAim(ball: Ball, aim: { angle: number; power: number } | null): void {
    if (aim === null) {
      this.aimLine.visible = false
      return
    }
    const len = AIM_LINE_MAX_PX * aim.power
    this.aimLinePosition.setXYZ(0, ball.x, ball.y, 0)
    this.aimLinePosition.setXYZ(
      1,
      ball.x + Math.cos(aim.angle) * len,
      ball.y + Math.sin(aim.angle) * len,
      0
    )
    this.aimLinePosition.needsUpdate = true
    this.aimLine.visible = true
  }

  setSolids(solids: readonly Rect[], workArea: Rect): void {
    for (const child of this.group.children.slice()) {
      this.group.remove(child)
      if (child instanceof THREE.Line) {
        child.geometry.dispose()
        ;(child.material as THREE.Material).dispose()
      }
    }
    this.group.add(makeOutline(workArea, WORK_AREA_COLOR))
    for (const s of solids) this.group.add(makeOutline(s, SOLID_COLOR))
  }
}
