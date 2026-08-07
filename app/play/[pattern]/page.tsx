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

const ROUTES: Record<string, RouteConfig> = {
  fork:              { load: () => import('@/scripts/games/fork.json'),              pattern: 'fork'              },
  forks_extended:    { load: () => import('@/scripts/games/forks_extended.json'),    pattern: 'fork'              },
  pin:               { load: () => import('@/scripts/games/pin.json'),               pattern: 'pin'               },
  back_rank_mate:    { load: () => import('@/scripts/games/back_rank_mate.json'),    pattern: 'back_rank_mate'    },
  skewer:            { load: () => import('@/scripts/games/skewer.json'),            pattern: 'skewer'            },
  discovered_attack: { load: () => import('@/scripts/games/discovered_attack.json'), pattern: 'discovered_attack' },
  double_check:      { load: () => import('@/scripts/games/double_check.json'),      pattern: 'double_check'      },
  deflection:        { load: () => import('@/scripts/games/deflection.json'),        pattern: 'deflection'        },
  decoy:             { load: () => import('@/scripts/games/decoy.json'),             pattern: 'decoy'             },
  smothered_mate:    { load: () => import('@/scripts/games/smothered_mate.json'),    pattern: 'smothered_mate'    },
  overloading:       { load: () => import('@/scripts/games/overloading.json'),       pattern: 'overloading'       },
  x_ray_attack:      { load: () => import('@/scripts/games/x_ray_attack.json'),      pattern: 'x_ray_attack'      },
  zwischenzug:       { load: () => import('@/scripts/games/zwischenzug.json'),       pattern: 'zwischenzug'       },
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
