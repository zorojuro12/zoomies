// A tiny .env reader (no dependency). Used once at startup so the main process can see the API keys in
// the gitignored `.env` during development. Never overrides a variable that already has a value.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let value = line.slice(eq + 1).trim()
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0]))
      value = value.slice(1, -1)
    out[key] = value
  }
  return out
}

export function applyDotenv(
  vars: Record<string, string>,
  env: Record<string, string | undefined>
): void {
  for (const [k, v] of Object.entries(vars)) if (!env[k]) env[k] = v
}

/** Load `.env` from the working directory or its parent (dev runs from `app/`, the file is at the repo root). */
export function loadDotenvFiles(
  env: Record<string, string | undefined>,
  cwd: string = process.cwd()
): void {
  for (const dir of [cwd, join(cwd, '..')]) {
    const file = join(dir, '.env')
    try {
      if (existsSync(file)) applyDotenv(parseDotenv(readFileSync(file, 'utf8')), env)
    } catch {
      // unreadable .env: carry on without it
    }
  }
}
