// §3.9 Landmarks — Abel produces assets/views/landmarks.json; Daniel's pipeline consumes it.
// Pixel coordinates in each image, origin top-left. Include only the points visible in a view.

export const LANDMARK_NAMES = [
  'nose_tip',
  'eye_l',
  'eye_r',
  'head_top',
  'chin',
  'ear_base_l',
  'ear_base_r',
  'ear_tip_l',
  'ear_tip_r',
  'withers',
  'chest_front',
  'belly_low',
  'shoulder_l',
  'shoulder_r',
  'elbow_l',
  'elbow_r',
  'front_paw_l',
  'front_paw_r',
  'hip_l',
  'hip_r',
  'stifle_l',
  'stifle_r',
  'hock_l',
  'hock_r',
  'rear_paw_l',
  'rear_paw_r',
  'tail_base',
  'tail_tip'
] as const

export type LandmarkName = (typeof LANDMARK_NAMES)[number]

/** front = assets/photo/dog.jpeg; the others = assets/views/<view>.png */
export type LandmarkView = 'front' | 'side_sit' | 'side_stand' | 'back'

export interface LandmarksFile {
  image_size: Partial<Record<LandmarkView, [number, number]>>
  front?: Partial<Record<LandmarkName, [number, number]>>
  side_sit?: Partial<Record<LandmarkName, [number, number]>>
  side_stand?: Partial<Record<LandmarkName, [number, number]>>
  back?: Partial<Record<LandmarkName, [number, number]>>
}
