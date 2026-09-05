import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { authzEnforced, getAuthzService, studentFromCookies } from '@/lib/authz/nextAdapter'
import { GamePage }  from './GamePage'
import type { ScriptedGame } from './GamePage'
import { loadJson } from '@/lib/content-fs'
import { PLAY_ROUTES, type LessonFeedback } from '@/lib/curriculum'
import { loadLessonContent, toLessonFeedback } from '@/lib/curriculum-server'

// The route table is generated from content/curriculum/index.json — the
// single source of truth. The URL segment (route_key) and the chess
// pattern key can differ: forks_extended is an aux route whose games
// carry pattern:"fork".

interface Props {
  params:        { pattern: string }
  searchParams?: { game?: string; delay?: string }
}

export default async function PlayPage({ params, searchParams }: Props) {
  // Session gate (AUTHZ_ENFORCE=1): playing requires a logged-in student
  // with an active booked-day usage session — see lib/authz.
  if (authzEnforced()) {
    const student = await studentFromCookies(cookies())
    if (!student) redirect('/account')
    if (!(await getAuthzService().getActiveSession(student.id))) redirect('/account')
  }

  const route = PLAY_ROUTES[params.pattern]
  if (!route) notFound()

  // Read from disk at request time (lib/content-fs) rather than a webpack
  // import() — keeps the server bundle flat no matter how many thousand
  // game files the curriculum grows to. Cached in-process after first read.
  const games = await loadJson<ScriptedGame[]>(route.gamesRef)

  // Lesson feedback strings come from content/lessons/<pattern>.json.
  const lesson = await loadLessonContent(route.pattern)
  const lessonFeedback: LessonFeedback | null = lesson ? toLessonFeedback(lesson) : null

  const game  = Number(searchParams?.game)
  const delay = Number(searchParams?.delay)

  return (
    <GamePage
      pattern={route.pattern}
      games={games}
      lessonFeedback={lessonFeedback}
      initialGameNumber={Number.isFinite(game) && game > 0 ? game : 1}
      moveDelayMs={Number.isFinite(delay) && delay > 0 ? delay : 600}
    />
  )
}

export function generateStaticParams() {
  return Object.keys(PLAY_ROUTES).map(pattern => ({ pattern }))
}
