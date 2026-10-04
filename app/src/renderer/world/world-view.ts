// Debug-only outlines of the work area and world solids (Task 6 of a-p1-overlay.md), plus the
// ball mesh (Task 7) — always visible, not debug-gated. Aim line is added in Task 8.
import * as THREE from 'three'
import type { Rect } from '@shared/geometry'
import type { Ball } from './ball'

const WORK_AREA_COLOR = 0xffffff
const SOLID_COLOR = 0x00ff88
const BALL_COLOR = 0xffcc00
// Above the dog's highest renderOrder (SdfDog's debug overlay uses 5).
const BALL_RENDER_ORDER = 10

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

  constructor(scene: THREE.Scene) {
    this.group.visible = false
    scene.add(this.group)

    const geometry = new THREE.CircleGeometry(1, 24)
    const material = new THREE.MeshBasicMaterial({ color: BALL_COLOR, side: THREE.DoubleSide })
    this.ballMesh = new THREE.Mesh(geometry, material)
    this.ballMesh.renderOrder = BALL_RENDER_ORDER
    scene.add(this.ballMesh)
  }

  setDebug(on: boolean): void {
    this.group.visible = on
  }

  setBall(ball: Ball): void {
    this.ballMesh.position.set(ball.x, ball.y, 0)
    this.ballMesh.scale.setScalar(ball.r)
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
