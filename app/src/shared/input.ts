// §3.6 Player input — Ansh produces it from mouse + serial; behaviour consumes it.
// angle: radians in world space (y down); power: 0..1.

export type InputEvent =
  | { kind: 'aim'; angle: number; power: number }
  | { kind: 'launch'; angle: number; power: number }
  | { kind: 'pet'; source: 'touch' | 'mouse' }
  | { kind: 'call' }
  | { kind: 'pushToTalk'; state: 'start' | 'stop' }
  | { kind: 'command'; text: string }
