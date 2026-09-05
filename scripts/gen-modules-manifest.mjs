// ── Module manifest generator ─────────────────────────────────────
// Scans the drop folder content/modules/<pattern>/<id>.module.json and
// writes content/curriculum/modules.json — the single file the roadmap
// (the candy-trail) loads. Run automatically by predev / prebuild /
// pretest, so "drop a .module.json in the folder" is all you do:
//
//   node scripts/gen-modules-manifest.mjs
//
// Each *.module.json is self-contained: roadmap metadata at the top
// level, then a `lessons` array. The manifest keeps only the metadata
// (+ a lessons_ref back to the file); lib/modules-server reads the
// lessons from the file on demand.

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const DROP_DIR = join(ROOT, 'content', 'modules')
const OUT = join(ROOT, 'content', 'curriculum', 'modules.json')

const WORLDS = [
  { id: 'beginner',     title: 'Beginner',     order: 1 },
  { id: 'intermediate', title: 'Intermediate', order: 2 },
  { id: 'advanced',     title: 'Advanced',     order: 3 },
  { id: 'expert',       title: 'Expert',       order: 4 },
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (name.endsWith('.module.json')) out.push(full)
  }
  return out
}

const files = walk(DROP_DIR).sort()
const modules = []
const errors = []

for (const file of files) {
  const rel = relative(ROOT, file).split('\\').join('/')
  let raw
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    errors.push(`${rel}: invalid JSON — ${e.message}`)
    continue
  }
  for (const field of ['id', 'pattern', 'title', 'world']) {
    if (!raw[field]) errors.push(`${rel}: missing "${field}"`)
  }
  if (errors.length) continue

  const lessonCount = Array.isArray(raw.lessons) ? raw.lessons.length : 0
  modules.push({
    id:          raw.id,
    order:       Number(raw.order) || modules.length + 1,
    world:       raw.world,
    pattern:     raw.pattern,
    title:       raw.title,
    subtitle:    raw.subtitle ?? undefined,
    icon:        raw.icon ?? '♟',
    is_free:     raw.is_free ?? false,
    status:      raw.status ?? (lessonCount > 0 ? 'published' : 'planned'),
    lessons_ref: rel,
    lesson_count: lessonCount,
  })
}

if (errors.length) {
  console.error('[modules] manifest generation failed:\n  ' + errors.join('\n  '))
  process.exit(1)
}

modules.sort((a, b) => a.order - b.order)

const knownWorlds = new Set(WORLDS.map(w => w.id))
for (const m of modules) {
  if (!knownWorlds.has(m.world)) {
    console.error(`[modules] ${m.id}: unknown world "${m.world}" (expected one of ${[...knownWorlds].join(', ')})`)
    process.exit(1)
  }
}

const manifest = {
  schema_version: '3.0',
  title: 'ChessQuest Roadmap',
  generated_by: 'scripts/gen-modules-manifest.mjs',
  worlds: WORLDS.filter(w => modules.some(m => m.world === w.id)),
  modules,
}

writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n')
console.log(`[modules] wrote ${relative(ROOT, OUT).split('\\').join('/')} — ${modules.length} module(s) from ${files.length} file(s)`)
