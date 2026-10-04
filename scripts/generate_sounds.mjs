#!/usr/bin/env node
// Generate the dog sound library with ElevenLabs Sound Effects (L1).
// Usage (from repo root):
//   node scripts/generate_sounds.mjs                 # P1 sounds, 3 variants each
//   node scripts/generate_sounds.mjs all             # every sound
//   node scripts/generate_sounds.mjs bark_happy 2    # one sound, 2 variants
// Reads ELEVENLABS_API_KEY from .env (never printed). Skips files that already exist.

import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'assets', 'sounds')

process.loadEnvFile(join(root, '.env'))
const apiKey = process.env.ELEVENLABS_API_KEY
if (!apiKey) throw new Error('ELEVENLABS_API_KEY missing from .env')

// Keep in sync with assets/sounds/SOUNDS.md and SOUND_NAMES in app/src/shared/audio.ts
const CLEAN = 'clean dry recording, no background noise'
const SOUNDS = {
  bark_happy: { p1: true, s: 1, text: `A single bright, higher-pitched "woof" from a happy small-to-medium dog, energetic, jolly and playful, light and cheerful, not deep, growly or aggressive, ${CLEAN}` },
  pant: { p1: true, s: 3, text: `A dog panting happily after running, steady rhythmic breathing, close microphone, no background noise` },
  snore: { p1: true, s: 3, text: `A sleeping dog snoring softly, slow deep breaths with a gentle rumble, no background noise` },
  ball_squeak: { p1: true, s: 1, text: 'A short, cute, playful rubber squeaky-toy squeak, one quick bright "squeak", soft and friendly, not harsh or shrill, clean dry recording, no background noise' },
  bark_alert: { s: 1, text: `A single sharp alert bark from a medium dog, attentive, ${CLEAN}` },
  yip_excited: { s: 1, text: `Two quick excited high-pitched yips from a dog, playful, ${CLEAN}` },
  whine: { s: 2, text: `A soft short dog whine, curious and a little pleading, ${CLEAN}` },
  yawn: { s: 2, text: `A dog yawning with a small squeaky whine at the end, sleepy, ${CLEAN}` },
  sneeze: { s: 1, text: `A quick small dog sneeze, ${CLEAN}` },
  sigh: { s: 2, text: `A dog letting out a long contented sigh while settling down, ${CLEAN}` },
  paw_step: { s: 1, text: 'Soft dog paws taking two quick steps on a hard surface, light claw taps' },
  ball_bounce: { s: 1, text: 'A small rubber ball bouncing once on a hard floor, single clear bounce' }
}

const [arg, countArg] = process.argv.slice(2)
const variants = Number(countArg ?? 3)
const names = !arg ? Object.keys(SOUNDS).filter((n) => SOUNDS[n].p1) : arg === 'all' ? Object.keys(SOUNDS) : [arg]
for (const n of names) if (!SOUNDS[n]) throw new Error(`Unknown sound: ${n}`)

const exists = (p) => access(p).then(() => true, () => false)
await mkdir(outDir, { recursive: true })

for (const name of names) {
  for (let i = 1; i <= variants; i++) {
    const file = join(outDir, `${name}_${i}.mp3`)
    if (await exists(file)) {
      console.log(`skip  ${name}_${i}.mp3 (exists)`)
      continue
    }
    const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_64', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: SOUNDS[name].text, duration_seconds: SOUNDS[name].s, prompt_influence: 0.5 })
    })
    if (!res.ok) {
      console.error(`FAIL  ${name}_${i}.mp3  HTTP ${res.status}`)
      if (res.status === 401 || res.status === 402 || res.status === 429) process.exit(1)
      continue
    }
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(file, buf)
    console.log(`ok    ${name}_${i}.mp3  ${(buf.length / 1024).toFixed(0)} KB`)
  }
}
