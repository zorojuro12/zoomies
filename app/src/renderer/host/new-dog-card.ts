// The "Making your dog…" card and the right-click menu (E2). The card is deliberately obvious: a big
// spinner, the whole step list with ticks, a progress bar and what is happening right now, so nobody
// wonders whether anything is going on. Errors stay on screen until closed; success says "Meet <name>!".
import type { NewDogProgress } from '@shared/ipc'

export type StepState = 'done' | 'current' | 'pending' | 'error'

/** What each step in the list looks like right now. */
export function stepStates(p: NewDogProgress): StepState[] {
  const cur = Math.max(0, Math.min(p.current, p.steps.length - 1)) // a bad index never breaks the card
  return p.steps.map((_, i) => {
    if (p.state === 'done') return 'done'
    if (i < cur) return 'done'
    if (i === cur) return p.state === 'error' ? 'error' : 'current'
    return 'pending'
  })
}

/** Keep a menu of w x h on screen: it opens left / up from the click when it would run off the edge. */
export function clampMenuPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  vw: number,
  vh: number
): { x: number; y: number } {
  return { x: Math.max(0, Math.min(x, vw - w)), y: Math.max(0, Math.min(y, vh - h)) }
}

const ICON: Record<StepState, string> = { done: '✓', current: '●', pending: '○', error: '✕' }
const COLOUR: Record<StepState, string> = {
  done: '#7ddc8a',
  current: '#f4c542',
  pending: '#6d7d89',
  error: '#ff7b7b'
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  css: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.style.cssText = css
  if (text !== undefined) e.textContent = text
  return e
}

export class NewDogCard {
  private readonly root: HTMLDivElement
  private readonly title: HTMLDivElement
  private readonly list: HTMLDivElement
  private readonly bar: HTMLDivElement
  private readonly detail: HTMLDivElement
  private readonly close: HTMLButtonElement
  private readonly spinner: HTMLDivElement
  private hideTimer: ReturnType<typeof setTimeout> | null = null
  private shown = false

  constructor(parent: HTMLElement) {
    const style = document.createElement('style')
    style.textContent = '@keyframes zoomies-spin{to{transform:rotate(360deg)}}'
    document.head.appendChild(style)
    this.root = el(
      'div',
      'position:fixed;left:50%;top:90px;transform:translateX(-50%);width:380px;display:none;' +
        'padding:16px 18px;border-radius:14px;background:rgba(18,26,32,.96);color:#e8eef2;z-index:30;' +
        'font:14px system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.45);border:1px solid #2c3d49'
    )
    const head = el('div', 'display:flex;align-items:center;gap:12px;margin-bottom:10px')
    this.spinner = el(
      'div',
      'width:22px;height:22px;border:3px solid #34505f;border-top-color:#f4c542;border-radius:50%;' +
        'animation:zoomies-spin .8s linear infinite;flex:none'
    )
    this.title = el('div', 'font-size:17px;font-weight:700', 'Making your dog…')
    head.append(this.spinner, this.title)
    this.list = el('div', 'display:grid;gap:5px;margin:8px 0 12px')
    const track = el('div', 'height:8px;border-radius:5px;background:#27363f;overflow:hidden')
    this.bar = el(
      'div',
      'height:100%;width:0;background:#f4c542;border-radius:5px;transition:width .35s ease'
    )
    track.appendChild(this.bar)
    this.detail = el('div', 'margin-top:9px;color:#a9bac6;min-height:18px')
    this.close = el(
      'button',
      'display:none;margin-top:12px;padding:6px 14px;border:0;border-radius:8px;background:#e8eef2;' +
        'color:#16212a;cursor:pointer;font:inherit',
      'Close'
    )
    this.close.addEventListener('click', () => this.hide())
    this.root.append(head, this.list, track, this.detail, this.close)
    for (const t of ['click', 'dblclick', 'contextmenu'] as const)
      this.root.addEventListener(t, (e) => e.stopPropagation())
    parent.appendChild(this.root)
  }

  update(p: NewDogProgress): void {
    if (this.hideTimer) clearTimeout(this.hideTimer)
    this.hideTimer = null
    this.shown = true
    this.root.style.display = 'block'
    const states = stepStates(p)
    this.list.replaceChildren(
      ...p.steps.map((label, i) => {
        const row = el(
          'div',
          `display:flex;gap:9px;align-items:baseline;color:${COLOUR[states[i]]}`
        )
        const mark = el('span', 'width:14px;text-align:center;flex:none', ICON[states[i]])
        const text = el('span', states[i] === 'pending' ? '' : 'font-weight:600', label)
        row.append(mark, text)
        return row
      })
    )
    this.bar.style.width = `${Math.max(0, Math.min(100, p.percent))}%`
    this.detail.textContent = p.detail
    const done = p.state === 'done'
    const error = p.state === 'error'
    this.spinner.style.display = p.state === 'running' ? 'block' : 'none'
    this.title.textContent = done
      ? `Meet ${p.message ?? 'your dog'}!`
      : error
        ? "Couldn't make your dog"
        : 'Making your dog…'
    this.title.style.color = error ? '#ff7b7b' : done ? '#7ddc8a' : '#e8eef2'
    this.bar.style.background = error ? '#ff7b7b' : done ? '#7ddc8a' : '#f4c542'
    this.close.style.display = error ? 'inline-block' : 'none'
    if (done) this.hideTimer = setTimeout(() => this.hide(), 4000)
  }

  hide(): void {
    this.shown = false
    this.root.style.display = 'none'
  }

  /** Is this point on the card? (The click-through overlay uses it so the Close button can be clicked.) */
  hit(x: number, y: number): boolean {
    if (!this.shown) return false
    const r = this.root.getBoundingClientRect()
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }
}

export interface DogMenuActions {
  onUpload(): void
  onReset(): void
}

/** The right-click menu on the dog: "Upload new dog…" and, once a custom dog is active, "Back to the original dog". */
export class DogMenu {
  private readonly root: HTMLDivElement
  private readonly reset: HTMLDivElement
  private shown = false

  constructor(
    parent: HTMLElement,
    private readonly actions: DogMenuActions
  ) {
    this.root = el(
      'div',
      'position:fixed;display:none;min-width:210px;padding:5px;border-radius:10px;z-index:40;' +
        'background:rgba(18,26,32,.97);color:#e8eef2;font:14px system-ui,sans-serif;' +
        'box-shadow:0 8px 30px rgba(0,0,0,.45);border:1px solid #2c3d49'
    )
    const item = (text: string, run: () => void): HTMLDivElement => {
      const row = el('div', 'padding:8px 12px;border-radius:7px;cursor:pointer', text)
      row.addEventListener('mouseenter', () => (row.style.background = '#2b3d49'))
      row.addEventListener('mouseleave', () => (row.style.background = 'transparent'))
      row.addEventListener('click', (e) => {
        e.stopPropagation()
        this.hide()
        run()
      })
      return row
    }
    this.reset = item('Back to the original dog', () => this.actions.onReset())
    this.root.append(
      item('Upload new dog…', () => this.actions.onUpload()),
      this.reset
    )
    for (const t of ['click', 'dblclick', 'contextmenu'] as const)
      this.root.addEventListener(t, (e) => e.stopPropagation())
    parent.appendChild(this.root)
    // anywhere else closes it
    window.addEventListener('pointerdown', (e) => {
      if (this.shown && !this.root.contains(e.target as Node)) this.hide()
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide()
    })
  }

  show(x: number, y: number, customDogActive: boolean): void {
    this.reset.style.display = customDogActive ? 'block' : 'none'
    this.root.style.display = 'block'
    const r = this.root.getBoundingClientRect()
    const pos = clampMenuPosition(x, y, r.width, r.height, window.innerWidth, window.innerHeight)
    this.root.style.left = `${pos.x}px`
    this.root.style.top = `${pos.y}px`
    this.shown = true
  }

  hide(): void {
    this.shown = false
    this.root.style.display = 'none'
  }

  hit(x: number, y: number): boolean {
    if (!this.shown) return false
    const r = this.root.getBoundingClientRect()
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }
}
