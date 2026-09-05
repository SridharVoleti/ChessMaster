import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authzEnforced, studentFromCookies } from '@/lib/authz/nextAdapter'
import { createServiceClient } from '@/lib/supabase/server'
import { getProgressSnapshot } from '@/lib/supabase/gameAttempts'
import { ModuleRoadmap } from '@/components/ModuleRoadmap'
import type { RoadmapProgress } from '@/lib/moduleRoadmap'

// The candy-trail roadmap is the app's home screen. The old marketing
// landing page now lives at /welcome.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ChessQuest — Your roadmap',
  description: 'Your tactical roadmap, Fork to Zwischenzug — one module at a time.',
}

export default async function HomeRoadmap() {
  let progress: RoadmapProgress = { patterns_mastered: [] }

  if (authzEnforced()) {
    const student = await studentFromCookies(cookies())
    if (!student) redirect('/account')

    // NOTE: assumes the authz Student.id doubles as
    // student_progress.user_id in Supabase — the same assumption
    // /api/validate-move already makes when a client passes userId.
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const supabase = createServiceClient()
        const snapshot = await getProgressSnapshot(supabase, student.id)
        progress = { patterns_mastered: snapshot.patterns_mastered }
      } catch {
        // best-effort — fall back to the "not started" default above
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="mx-auto max-w-md px-4 pt-8 text-center">
        <h1 className="font-display text-3xl font-extrabold text-slate-900">Your roadmap</h1>
        <p className="mt-2 text-slate-600">Fork to Zwischenzug — one module at a time.</p>
      </header>
      <ModuleRoadmap progress={progress} />
    </main>
  )
}
