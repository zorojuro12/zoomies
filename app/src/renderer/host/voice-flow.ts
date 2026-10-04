// What happens to a finished recording (P3 serial, phase D3): ask the main process what was said; words go
// to the command router (Gemini, then the word list), and "nothing heard" or any failure becomes an empty
// command, which makes the dog tilt its head, so a voice command never dies silently.
export async function handleClip(
  bytes: Uint8Array,
  mime: string,
  transcribe: (bytes: Uint8Array, mime: string) => Promise<string | null>,
  route: (text: string) => void,
  send: (text: string) => void,
  report: (message: string) => void = () => undefined
): Promise<void> {
  let heard: string | null
  try {
    heard = await transcribe(bytes, mime)
  } catch {
    heard = null
  }
  if (heard && heard.trim()) {
    report(`heard "${heard.trim()}"`)
    route(heard)
  } else {
    report(heard === null ? 'could not transcribe (offline or no key?)' : 'heard nothing')
    send('')
  }
}
