// Command bar (P3 serial, phase D1): a row of buttons (and, where the window can take keyboard
// focus, a text box) that gives the dog a command by mouse. It is the fallback for the controller and
// the microphone ("every hardware action has a mouse equivalent"), and the quickest way to test the
// command list. Hidden until ?commands=1 (ZOOMIES_COMMANDS=1) or the C key.
import { COMMAND_LABELS, COMMAND_NAMES } from '../behaviour/commands'

export class CommandBar {
  private readonly root: HTMLDivElement
  private shown = false

  /** `sendTyped`: also show a text box (not in the click-through overlay, which cannot take keystrokes). */
  constructor(
    parent: HTMLElement,
    private readonly send: (text: string) => void,
    sendTyped: ((text: string) => void) | null
  ) {
    const root = document.createElement('div')
    root.style.cssText =
      'position:fixed;top:10px;left:50%;transform:translateX(-50%);display:none;gap:6px;' +
      'padding:6px 8px;border-radius:10px;background:rgba(20,28,34,.82);z-index:10;' +
      'font:13px system-ui,sans-serif;align-items:center'
    for (const name of COMMAND_NAMES) {
      const b = document.createElement('button')
      b.textContent = COMMAND_LABELS[name]
      b.style.cssText =
        'padding:5px 10px;border:0;border-radius:7px;background:#e8eef2;color:#16212a;cursor:pointer'
      b.addEventListener('click', () => this.send(name))
      root.appendChild(b)
    }
    if (sendTyped) {
      const input = document.createElement('input')
      input.placeholder = 'say something…'
      input.style.cssText = 'padding:5px 8px;border-radius:7px;border:0;width:150px'
      input.addEventListener('keydown', (e) => {
        e.stopPropagation() // typing a "c" must not hide the bar
        if (e.key === 'Enter' && input.value.trim()) {
          sendTyped(input.value)
          input.value = ''
        }
      })
      root.appendChild(input)
    }
    // clicks on the bar are not clicks on the dog or the desktop
    for (const t of ['click', 'dblclick'] as const)
      root.addEventListener(t, (e) => e.stopPropagation())
    parent.appendChild(root)
    this.root = root
  }

  get visible(): boolean {
    return this.shown
  }

  setVisible(on: boolean): void {
    this.shown = on
    this.root.style.display = on ? 'flex' : 'none'
  }

  toggle(): void {
    this.setVisible(!this.shown)
  }

  /** Is this point on the bar? (The click-through overlay uses it to let the mouse reach the buttons.) */
  hit(x: number, y: number): boolean {
    if (!this.shown) return false
    const r = this.root.getBoundingClientRect()
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }
}
