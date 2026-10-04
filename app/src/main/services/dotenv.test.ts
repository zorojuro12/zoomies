// A tiny .env reader (no dependency): KEY=value lines, comments, quotes; never overrides a real env var.
import { describe, expect, it } from 'vitest'
import { parseDotenv, applyDotenv } from './dotenv'

describe('parseDotenv', () => {
  it('reads KEY=value lines', () => {
    expect(parseDotenv('A=1\nB=two')).toEqual({ A: '1', B: 'two' })
  })
  it('skips comments, blanks and junk', () => {
    expect(parseDotenv('# hi\n\nnot a line\nA=1\n  # indented comment')).toEqual({ A: '1' })
  })
  it('strips matching quotes and surrounding spaces, keeps = inside values, handles \\r\\n', () => {
    expect(parseDotenv('A = "x y"\r\nB=\'q\'\r\nC=a=b')).toEqual({ A: 'x y', B: 'q', C: 'a=b' })
  })
  it('an empty value stays empty', () => {
    expect(parseDotenv('A=')).toEqual({ A: '' })
  })
})

describe('applyDotenv', () => {
  it('sets missing variables, keeps ones that already have a value, fills empty ones', () => {
    const env: Record<string, string | undefined> = { KEEP: 'real', EMPTY: '' }
    applyDotenv({ KEEP: 'file', EMPTY: 'filled', NEW: 'n' }, env)
    expect(env).toEqual({ KEEP: 'real', EMPTY: 'filled', NEW: 'n' })
  })
})
