import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { authzEnforced, getAuthzService, studentFromCookies } from '@/lib/authz/nextAdapter'
import { GamePage }  from './GamePage'
import type { ScriptedGame } from './GamePage'

// Route key → { file loader, chess pattern key passed to GamePage }
// The route key (URL segment) and the chess pattern key can differ —
// e.g. forks_extended is a test route whose games have pattern:"fork".
interface RouteConfig {
  load:    () => Promise<{ default: ScriptedGame[] }>
  pattern: string
}

// JSON module imports infer widened field types (e.g. side: string, not the
// 'white' | 'black' union ScriptedGame declares), so each loader's result is
// cast through unknown to the declared shape.
type JsonGames = Promise<{ default: unknown[] }>
const asGames = (p: JsonGames) => p as Promise<{ default: ScriptedGame[] }>

const ROUTES: Record<string, RouteConfig> = {
  fork:              { load: () => asGames(import('@/scripts/games/fork.json')),              pattern: 'fork'              },
  forks_extended:    { load: () => asGames(import('@/scripts/games/forks_extended.json')),    pattern: 'fork'              },
  pin:               { load: () => asGames(import('@/scripts/games/pin.json')),               pattern: 'pin'               },
  back_rank_mate:    { load: () => asGames(import('@/scripts/games/back_rank_mate.json')),    pattern: 'back_rank_mate'    },
  skewer:            { load: () => asGames(import('@/scripts/games/skewer.json')),            pattern: 'skewer'            },
  discovered_attack: { load: () => asGames(import('@/scripts/games/discovered_attack.json')), pattern: 'discovered_attack' },
  double_check:      { load: () => asGames(import('@/scripts/games/double_check.json')),      pattern: 'double_check'      },
  deflection:        { load: () => asGames(import('@/scripts/games/deflection.json')),        pattern: 'deflection'        },
  decoy:             { load: () => asGames(import('@/scripts/games/decoy.json')),             pattern: 'decoy'             },
  smothered_mate:    { load: () => asGames(import('@/scripts/games/smothered_mate.json')),    pattern: 'smothered_mate'    },
  overloading:       { load: () => asGames(import('@/scripts/games/overloading.json')),       pattern: 'overloading'       },
  x_ray_attack:      { load: () => asGames(import('@/scripts/games/x_ray_attack.json')),      pattern: 'x_ray_attack'      },
  zwischenzug:       { load: () => asGames(import('@/scripts/games/zwischenzug.json')),       pattern: 'zwischenzug'       },
}

interface Props {
  params:        { pattern: string }
  searchParams?: { game?: string; delay?: string }
}

export default async function PlayPage({ params, searchParams }: Props) {
  // Session gate (AUTHZ_ENFORCE=1): playing requires a logged-in student
  // with an active booked-day usage session — see lib/authz.
  if (authzEnforced()) {
    const student = studentFromCookies(cookies())
    if (!student) redirect('/account')
    if (!getAuthzService().getActiveSession(student.id)) redirect('/account')
  }

  const route = ROUTES[params.pattern]
  if (!route) notFound()

  const { default: games } = await route.load()

  const game  = Number(searchParams?.game)
  const delay = Number(searchParams?.delay)

  return (
    <GamePage
      pattern={route.pattern}
      games={games}
      initialGameNumber={Number.isFinite(game) && game > 0 ? game : 1}
      moveDelayMs={Number.isFinite(delay) && delay > 0 ? delay : 600}
    />
  )
}

export function generateStaticParams() {
  return Object.keys(ROUTES).map(pattern => ({ pattern }))
}
