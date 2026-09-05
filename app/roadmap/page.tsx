import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authzEnforced, studentFromCookies } from '@/lib/authz/nextAdapter'
import { createServiceClient } from '@/lib/supabase/server'
import { getProgressSnapshot } from '@/lib/supabase/gameAttempts'
import { RoadmapTrail } from '@/components/RoadmapTrail'
import { PATTERN_SEQUENCE, type PatternKey } from '@/lib/curriculum'
import type { StudentProgressInput } from '@/lib/roadmapUtils'

export const dynamic = 'force-dynamic'

const NOT_STARTED: StudentProgressInput = {
  current_pattern:     PATTERN_SEQUENCE[0].key,
  current_game_number: 1,
  patterns_mastered:   [],
}

export default async function RoadmapPage() {
  let progress: StudentProgressInput = NOT_STARTED

  if (authzEnforced()) {
    const student = await studentFromCookies(cookies())
    if (!student) redirect('/account')

    // NOTE: this assumes the authz Student.id doubles as
    // student_progress.user_id in Supabase — the same assumption
    // /api/validate-move already makes when a client passes userId.
    // Confirm that identity mapping before relying on this in production;
    // if authz and Supabase turn out to use separate id spaces, resolve
    // the real Supabase user id here instead of student.id.
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const supabase = createServiceClient()
        const snapshot = await getProgressSnapshot(supabase, student.id)
        progress = {
          current_pattern:     snapshot.current_pattern as PatternKey,
          current_game_number: snapshot.current_game_number,
          patterns_mastered:   snapshot.patterns_mastered,
        }
      } catch {
        // best-effort — fall back to the "not started" default above
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="mx-auto max-w-md px-4 pt-8 text-center">
        <h1 className="font-display text-3xl font-extrabold text-slate-900">Your roadmap</h1>
        <p className="mt-2 text-slate-600">Fork to Zwischenzug — one pattern at a time.</p>
      </header>
      <RoadmapTrail progress={progress} />
    </main>
  )
}
