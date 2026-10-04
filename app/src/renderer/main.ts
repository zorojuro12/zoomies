// Renderer entry. Scaffold only: proves Three.js renders with an orthographic
// camera in desktop pixels (y down, see CLAUDE.md). Lane A replaces this with
// the overlay render host in P1.
import * as THREE from 'three'
import { APP_NAME, FRAME_BUDGET_MS } from '@shared/app-info'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const status = document.getElementById('status') as HTMLDivElement

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setPixelRatio(window.devicePixelRatio)

const scene = new THREE.Scene()
// Orthographic camera mapped to window pixels with y pointing down.
const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1000, 1000)

const marker = new THREE.Mesh(
  new THREE.CircleGeometry(24, 32),
  new THREE.MeshBasicMaterial({ color: 0xa8561e })
)
scene.add(marker)

function resize(): void {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h, false)
  camera.left = 0
  camera.right = w
  camera.top = 0
  camera.bottom = h
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

let last = performance.now()
function frame(now: number): void {
  const dt = now - last
  last = now
  marker.position.set(window.innerWidth / 2 + Math.cos(now / 600) * 80, window.innerHeight / 2, 0)
  renderer.render(scene, camera)
  status.textContent = `${APP_NAME} scaffold · ${dt.toFixed(1)} ms (budget ${FRAME_BUDGET_MS.toFixed(1)} ms)`
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
