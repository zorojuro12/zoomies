// The dog editor panel: sliders for every proportion, ear/tail type and a colour picker per part.
// Drag a slider and the dog changes live; Save downloads the dog's .spec.json for the repo.
// All the logic (clamping, validation, file format) is in editor-model.ts (tested); this file is
// only the DOM, checked by eye.
import { COLOR_KEYS, EAR_TYPES, TAIL_TYPES } from '../../dog/spec/dog-spec'
import type { ColorKey, DogSpec } from '../../dog/spec/dog-spec'
import {
  COLOR_LABELS,
  serializeSpec,
  SLIDERS,
  specFileName,
  withColor,
  withEarType,
  withName,
  withNumber,
  withTailType
} from './editor-model'

export interface SpecEditorOptions {
  spec: DogSpec
  /** Called (at most once per frame) with the edited spec. */
  onChange: (spec: DogSpec) => void
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration> = {},
  text = ''
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  Object.assign(e.style, style)
  if (text) e.textContent = text
  return e
}

export function mountSpecEditor(host: HTMLElement, opts: SpecEditorOptions): void {
  let spec = opts.spec
  let queued = false
  const changed = (): void => {
    if (queued) return // coalesce a burst of slider events into one rebuild per frame
    queued = true
    requestAnimationFrame(() => {
      queued = false
      opts.onChange(spec)
    })
  }

  const panel = el('div', {
    position: 'fixed',
    top: '0',
    right: '0',
    bottom: '0',
    width: '290px',
    overflowY: 'auto',
    boxSizing: 'border-box',
    padding: '12px',
    background: 'rgba(250,248,244,0.96)',
    font: '12px system-ui, sans-serif',
    color: '#222',
    boxShadow: '-2px 0 8px rgba(0,0,0,0.25)'
  })
  panel.appendChild(el('div', { font: 'bold 14px system-ui', marginBottom: '8px' }, 'Dog editor'))

  // name + save
  const nameRow = el('div', { display: 'flex', gap: '6px', marginBottom: '10px' })
  const name = el('input', { flex: '1', padding: '4px' })
  name.value = spec.name
  name.addEventListener('input', () => {
    spec = withName(spec, name.value)
  })
  const save = el('button', { padding: '4px 10px', fontWeight: 'bold' }, 'Save')
  const status = el('div', { color: '#2a6', marginBottom: '8px', minHeight: '14px' })
  save.addEventListener('click', () => {
    const blob = new Blob([serializeSpec(spec)], { type: 'application/json' })
    const a = el('a')
    a.href = URL.createObjectURL(blob)
    a.download = specFileName(spec)
    a.click()
    URL.revokeObjectURL(a.href)
    status.textContent = `Saved ${a.download} — put it in assets/dog/ and commit it.`
  })
  nameRow.append(name, save)
  panel.append(nameRow, status)

  // sliders
  panel.appendChild(el('div', { fontWeight: 'bold', margin: '6px 0 4px' }, 'Proportions'))
  for (const def of SLIDERS) {
    const row = el('div', {
      display: 'grid',
      gridTemplateColumns: '96px 1fr 38px',
      gap: '6px',
      alignItems: 'center',
      marginBottom: '3px'
    })
    const input = el('input')
    input.type = 'range'
    input.min = String(def.min)
    input.max = String(def.max)
    input.step = String(def.step)
    const value = def.key === 'size' ? spec.size : spec.proportions[def.key]
    input.value = String(value)
    const readout = el('span', { textAlign: 'right' }, value.toFixed(2))
    input.addEventListener('input', () => {
      spec = withNumber(spec, def.key, Number(input.value))
      readout.textContent = Number(input.value).toFixed(2)
      changed()
    })
    row.append(el('span', {}, def.label), input, readout)
    panel.appendChild(row)
  }

  // ear + tail type
  panel.appendChild(el('div', { fontWeight: 'bold', margin: '10px 0 4px' }, 'Ears and tail'))
  for (const [label, options, current, apply] of [
    ['Ear type', EAR_TYPES, spec.earType, withEarType],
    ['Tail type', TAIL_TYPES, spec.tailType, withTailType]
  ] as const) {
    const row = el('div', {
      display: 'grid',
      gridTemplateColumns: '96px 1fr',
      gap: '6px',
      marginBottom: '3px'
    })
    const select = el('select')
    for (const o of options) {
      const opt = el('option', {}, o)
      opt.value = o
      select.appendChild(opt)
    }
    select.value = current
    select.addEventListener('change', () => {
      spec = apply(spec, select.value)
      changed()
    })
    row.append(el('span', {}, label), select)
    panel.appendChild(row)
  }

  // colours
  panel.appendChild(el('div', { fontWeight: 'bold', margin: '10px 0 4px' }, 'Colours'))
  const grid = el('div', { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' })
  for (const key of COLOR_KEYS as readonly ColorKey[]) {
    const row = el('label', { display: 'flex', alignItems: 'center', gap: '6px' })
    const input = el('input')
    input.type = 'color'
    input.value = spec.colors[key]
    input.style.width = '34px'
    input.addEventListener('input', () => {
      spec = withColor(spec, key, input.value)
      changed()
    })
    row.append(input, el('span', {}, COLOR_LABELS[key]))
    grid.appendChild(row)
  }
  panel.appendChild(grid)

  host.appendChild(panel)
}
