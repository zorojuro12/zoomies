// Command router (P3 serial, phase D2): typed (and later spoken) text goes to the AI first. The AI answers
// with one of the dog's commands, 'none' (not a dog action) or 'error' (offline / no key / timeout), and
// on 'error' the raw text is handed to the dog, whose fixed word list (behaviour/commands.ts) takes over.
// Async and never awaited in the frame loop.
export type Interpret = (text: string) => Promise<string>

export async function routeCommand(
  text: string,
  interpret: Interpret,
  send: (text: string) => void
): Promise<void> {
  if (!text.trim()) return
  let answer: string
  try {
    answer = await interpret(text)
  } catch {
    answer = 'error'
  }
  if (answer === 'error') send(text)
  else if (answer === 'none') send('')
  else send(answer)
}
