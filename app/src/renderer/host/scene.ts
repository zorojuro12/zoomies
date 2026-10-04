// Shared render setup for the app host and the dog preview page: an orthographic camera in
// window pixels with y pointing down (CLAUDE.md coordinates), plus simple lighting.
import * as THREE from 'three'
import type { DogRenderContext } from '@shared/dog-view'

export function createRenderContext(canvas: HTMLCanvasElement): DogRenderContext & {
  resize: () => void
} {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1000, 1000)
  camera.position.z = 500

  scene.add(new THREE.AmbientLight(0xffffff, 1.6))
  const key = new THREE.DirectionalLight(0xffffff, 1.8)
  key.position.set(-0.4, -1, 1)
  scene.add(key)

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
  return { renderer, scene, camera, resize }
}

export async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
  return (await res.json()) as T
}
