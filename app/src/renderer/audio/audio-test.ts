// Sound test page: a Play / Stop button per sound, plus pan and gain sliders, to hear the
// library through the real player. Open /audio/audio-test.html on the `npm run dev` server.
import { SOUND_NAMES } from '@shared/audio'
import { WebAudioPlayer } from './web-audio-player'

// This page lives in audio/, so the default relative assetUrl would point at /audio/sounds/.
const player = new WebAudioPlayer({ urlFor: (path) => `/${path}` })

const panInput = document.getElementById('pan') as HTMLInputElement
const gainInput = document.getElementById('gain') as HTMLInputElement
const rows = document.getElementById('rows') as HTMLDivElement
const status = document.getElementById('status') as HTMLDivElement

function show(input: HTMLInputElement, outId: string): void {
  const out = document.getElementById(outId)
  if (out) out.textContent = input.value
}
panInput.addEventListener('input', () => show(panInput, 'panVal'))
gainInput.addEventListener('input', () => show(gainInput, 'gainVal'))

void player.preload().then(() => {
  let loaded = 0
  for (const name of SOUND_NAMES) {
    const n = player.variantCount(name)
    if (n > 0) loaded++
    const label = document.createElement('div')
    label.textContent = name
    const count = document.createElement('div')
    count.textContent = n > 0 ? `${n} variant${n > 1 ? 's' : ''}` : 'missing'
    const buttons = document.createElement('div')
    const play = document.createElement('button')
    play.textContent = 'Play'
    play.addEventListener('click', () =>
      player.playSound(name, { pan: Number(panInput.value), gain: Number(gainInput.value) })
    )
    const stop = document.createElement('button')
    stop.textContent = 'Stop'
    stop.addEventListener('click', () => player.stop(name))
    buttons.append(play, ' ', stop)
    if (n === 0) for (const el of [label, count, buttons]) el.classList.add('missing')
    rows.append(label, count, buttons)
  }
  status.textContent = `${loaded} of ${SOUND_NAMES.length} sounds have files. Click Play (a click is needed before the browser allows sound).`
})
