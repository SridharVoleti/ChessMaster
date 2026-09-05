import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs'
import { join } from 'path'
import { loadJson, __clearContentCache } from '../lib/content-fs'

// content-fs reads relative to process.cwd() — Jest's cwd is the repo root
// (jest.config.ts has no rootDir override), matching how Next resolves
// process.cwd() at runtime.
const FIXTURE_DIR  = join(process.cwd(), '__tests__', '.tmp-content-fs')
const FIXTURE_REL  = '__tests__/.tmp-content-fs/fixture.json'
const FIXTURE_PATH = join(process.cwd(), FIXTURE_REL)

beforeEach(() => {
  __clearContentCache()
  mkdirSync(FIXTURE_DIR, { recursive: true })
})

afterEach(() => {
  try { unlinkSync(FIXTURE_PATH) } catch { /* already gone */ }
  try { rmdirSync(FIXTURE_DIR) } catch { /* not empty / already gone */ }
})

describe('loadJson', () => {
  it('reads and parses a JSON file by repo-relative path', async () => {
    writeFileSync(FIXTURE_PATH, JSON.stringify({ hello: 'world' }))
    const data = await loadJson<{ hello: string }>(FIXTURE_REL)
    expect(data).toEqual({ hello: 'world' })
  })

  it('caches after the first read — a later on-disk change is not seen', async () => {
    writeFileSync(FIXTURE_PATH, JSON.stringify({ v: 1 }))
    const first = await loadJson<{ v: number }>(FIXTURE_REL)
    expect(first).toEqual({ v: 1 })

    writeFileSync(FIXTURE_PATH, JSON.stringify({ v: 2 }))
    const second = await loadJson<{ v: number }>(FIXTURE_REL)
    expect(second).toEqual({ v: 1 }) // still cached
  })

  it('re-reads after __clearContentCache', async () => {
    writeFileSync(FIXTURE_PATH, JSON.stringify({ v: 1 }))
    await loadJson(FIXTURE_REL)

    writeFileSync(FIXTURE_PATH, JSON.stringify({ v: 2 }))
    __clearContentCache()

    const data = await loadJson<{ v: number }>(FIXTURE_REL)
    expect(data).toEqual({ v: 2 })
  })

  it('rejects for a missing file', async () => {
    await expect(loadJson('__tests__/.tmp-content-fs/does-not-exist.json')).rejects.toThrow()
  })
})
