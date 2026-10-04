// DogRig: the dog's skeleton as a tree of three.js nodes, built from a DogFile's bones. The motion
// code sets each bone's rotation every frame; SdfDog reads the nodes' world matrices and hands them
// to the shader. Nothing here is drawn: bones are plain Object3Ds (no meshes).
import * as THREE from 'three'
import type { DogFile } from '@shared/dog-file'

const AXIS_X = new THREE.Vector3(1, 0, 0)
const AXIS_Y = new THREE.Vector3(0, 1, 0)
const AXIS_Z = new THREE.Vector3(0, 0, 1)
// Scratch objects reused every frame — no per-frame allocation (CLAUDE.md "hot paths").
const qa = new THREE.Quaternion()
const qb = new THREE.Quaternion()

export class DogRig {
  readonly root = new THREE.Group()
  private readonly nodes = new Map<string, THREE.Object3D>()
  /** Each bone's rest rotation about z, in radians. */
  readonly restAngleZ = new Map<string, number>()

  constructor(dog: DogFile) {
    for (const bone of dog.bones) {
      const node = new THREE.Object3D()
      node.name = bone.name
      node.position.fromArray(bone.restPos)
      node.quaternion.fromArray(bone.restRot)
      this.nodes.set(bone.name, node)
      // Rest rotations in a dog file are about z; recover the angle (2 * atan2(z, w)).
      this.restAngleZ.set(bone.name, 2 * Math.atan2(bone.restRot[2], bone.restRot[3]))
    }
    for (const bone of dog.bones) {
      const node = this.nodes.get(bone.name)!
      const parent = bone.parent ? this.nodes.get(bone.parent) : this.root
      if (!parent) throw new Error(`DogRig: bone ${bone.name} has unknown parent ${bone.parent}`)
      parent.add(node)
    }
  }

  node(name: string): THREE.Object3D {
    const n = this.nodes.get(name)
    if (!n) throw new Error(`DogRig: no bone named ${name}`)
    return n
  }

  /** Set a bone's rotation (radians): about z (swing in the side plane), then y (turn), then x (roll). */
  setBone(name: string, angleZ: number, angleY = 0, angleX = 0): void {
    const node = this.node(name)
    qa.setFromAxisAngle(AXIS_Z, angleZ)
    if (angleY !== 0) qa.multiply(qb.setFromAxisAngle(AXIS_Y, angleY))
    if (angleX !== 0) qa.multiply(qb.setFromAxisAngle(AXIS_X, angleX))
    node.quaternion.copy(qa)
  }
}
