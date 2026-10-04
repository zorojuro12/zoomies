// Debug-only outlines of the work area and world solids (Task 6 of a-p1-overlay.md). Replaces
// Task 4's temporary 2D canvas. Ball and aim line are added on top in Tasks 7-8.
import * as THREE from 'three'
import type { Rect } from '@shared/geometry'

const WORK_AREA_COLOR = 0xffffff
const SOLID_COLOR = 0x00ff88

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

  constructor(scene: THREE.Scene) {
    this.group.visible = false
    scene.add(this.group)
  }

  setDebug(on: boolean): void {
    this.group.visible = on
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
