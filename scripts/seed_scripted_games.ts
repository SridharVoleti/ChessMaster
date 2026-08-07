// scripts/seed_scripted_games.ts
// Reads every scripts/games/<pattern>.json and upserts into Supabase.
//
// Usage:
//   npx ts-node --project tsconfig.json scripts/seed_scripted_games.ts
//
// Requires in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL=
//   SUPABASE_SERVICE_KEY=       ← service role key (bypasses RLS)

import { createClient } from '@supabase/supabase-js'
import * as fs          from 'fs'
import * as path        from 'path'
import * as dotenv      from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

// ── Types ─────────────────────────────────────────────────────────
interface GameJson {
  pattern:          string
  game_number:      number
  game_type?:       string
  title:            string
  opening:          string
  story:            string
  pgn:              string
  setup_fen:        string
  side:             'white' | 'black'
  pattern_fen?:     string
  best_move?:       string
  target_patterns?: string[]
  checkpoints?:     { ply: number; pattern: string }[]
}

// ── Load all game files ────────────────────────────────────────────
function loadAllGames(): GameJson[] {
  const gamesDir = path.resolve(__dirname, 'games')
  const files    = fs.readdirSync(gamesDir).filter(f => f.endsWith('.json'))
  const all: GameJson[] = []

  for (const file of files) {
    const filePath = path.join(gamesDir, file)
    const games: GameJson[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    if (games.length > 0) {
      console.log(`  Loaded ${games.length.toString().padStart(3)} games from ${file}`)
      all.push(...games)
    }
  }

  return all
}

// ── Main ──────────────────────────────────────────────────────────
async function seed() {
  console.log('Reading game files from scripts/games/…\n')
  const games = loadAllGames()
  console.log(`\nSeeding ${games.length} total games into scripted_games…\n`)

  const rows = games.map(g => ({
    pattern:         g.pattern,
    game_number:     g.game_number,
    game_type:       g.game_type        ?? 'practice',
    title:           g.title,
    opening:         g.opening,
    story:           g.story,
    pgn:             g.pgn,
    setup_fen:       g.setup_fen,
    side:            g.side,
    pattern_fen:     g.pattern_fen      ?? null,
    best_move:       g.best_move        ?? null,
    target_patterns: g.target_patterns  ?? [],
    checkpoints:     g.checkpoints      ?? [],
  }))

  // Upsert in batches of 100 to avoid request size limits
  const BATCH = 100
  let seeded = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)

    const { data, error } = await supabase
      .from('scripted_games')
      .upsert(batch, { onConflict: 'pattern,game_number' })
      .select('id, pattern, game_number, game_type')

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} failed:`, error.message)
      process.exit(1)
    }

    seeded += data?.length ?? 0
  }

  console.log(`✓ Seeded ${seeded} games\n`)

  // Summary by pattern
  const byPattern: Record<string, number> = {}
  for (const g of games) {
    byPattern[g.pattern] = (byPattern[g.pattern] ?? 0) + 1
  }
  for (const [pattern, count] of Object.entries(byPattern).sort()) {
    console.log(`  ${pattern.padEnd(22)} ${count} games`)
  }
}

seed()
