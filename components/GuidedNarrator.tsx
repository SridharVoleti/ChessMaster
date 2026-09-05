'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { pickNarrationVoice } from '@/lib/speech'
import type { GuidedStep } from '@/lib/narration'

// ── Guided replay control ────────────────────────────────────────
// Walks a lesson's steps (story, then one per commentary line) and
// keeps the board and the commentary in lock-step:
//
//   play the move  →  show + read its commentary  →  play the next move …
//
// The visual walkthrough (move + highlighted commentary line) always
// runs — it is driven by a timer, NOT by speech. If a speech voice is
// available it also reads each line aloud and the step waits for it;
// if not (voice still loading, offline, unsupported) the step just
// pauses long enough to read the line. So "commentary loading" never
// depends on the audio engine.

const MOVE_BEAT_MS = 340 // let a move land visually before its line shows

// No-voice pace: how long to hold on a line so it can be read on screen.
function dwellMs(text: string): number {
  return Math.min(4800, Math.max(1500, text.length * 38))
}

// Voice pace: a generous ceiling for how long this line could take to
// *speak* — only used if neither `onend` nor the `speaking` poll ever
// reports the utterance finished. ~90ms/char ≈ well past a natural TTS
// rate, so real completion always wins and this just stops a hang.
function speechCeilingMs(text: string): number {
  return Math.min(22000, 3000 + text.length * 90)
}

type Phase = 'idle' | 'playing' | 'paused' | 'done'

interface Props {
  steps:              GuidedStep[]
  onApplyThroughPly:  (ply: number) => void
  onReset:            () => void
  onFinished:         () => void
  onActiveStepChange: (index: number | null) => void
  /** bump to force stop + reset (parent switched game / pressed Play Again) */
  resetKey:           number
}

export function GuidedNarrator({
  steps,
  onApplyThroughPly,
  onReset,
  onFinished,
  onActiveStepChange,
  resetKey,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [hasVoice, setHasVoice] = useState(false)
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const stepRef  = useRef(0)
  // bumped on every stop/pause/reset/unmount so a stale async loop bails
  const tokenRef = useRef(0)

  // ── Voice loading (best-effort; Edge populates the list async) ──
  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!synth) return

    const refresh = () => {
      voiceRef.current = pickNarrationVoice(synth.getVoices())
      setHasVoice(Boolean(voiceRef.current))
    }
    refresh()
    synth.addEventListener('voiceschanged', refresh)
    const timers = [250, 1500, 4000].map(ms => window.setTimeout(refresh, ms))

    return () => {
      synth.removeEventListener('voiceschanged', refresh)
      timers.forEach(window.clearTimeout)
      tokenRef.current += 1
      synth.cancel()
    }
  }, [])

  // ── Reset when the parent changes lesson / restarts ────────────
  useEffect(() => {
    tokenRef.current += 1
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    stepRef.current = 0
    onActiveStepChange(null)
    setPhase('idle')
  }, [resetKey, onActiveStepChange])

  const runFrom = useCallback((startIndex: number) => {
    if (steps.length === 0) return
    const token = ++tokenRef.current
    setPhase('playing')

    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms))

    // Speak a line to the end, then move on. Completion is detected three
    // ways because Edge's Online (Natural) voices frequently never fire
    // `onend`: (1) the `onend`/`onerror` events, (2) polling
    // `synth.speaking` — once it has gone true and then back to false the
    // utterance is done even without an event, (3) a generous ceiling so
    // a fully-dropped utterance still can't hang the walkthrough.
    // No voice → just hold long enough to read the line on screen.
    const narrate = (text: string) =>
      new Promise<void>(resolve => {
        let settled = false
        let poll = 0
        let ceiling = 0
        const finish = () => {
          if (settled) return
          settled = true
          if (poll) window.clearInterval(poll)
          if (ceiling) window.clearTimeout(ceiling)
          resolve()
        }

        if (!synth || !voiceRef.current) {
          window.setTimeout(finish, dwellMs(text))
          return
        }

        try {
          synth.cancel() // flush any straggler from the previous line
          const u = new SpeechSynthesisUtterance(text)
          try { u.voice = voiceRef.current } catch { /* default voice */ }
          u.lang = voiceRef.current.lang || 'en-US'
          u.rate = 1.05
          u.onend = finish
          u.onerror = finish
          synth.speak(u)
        } catch {
          window.setTimeout(finish, dwellMs(text))
          return
        }

        let hasSpoken = false
        poll = window.setInterval(() => {
          if (synth.speaking) hasSpoken = true
          else if (hasSpoken) finish()          // spoke, then stopped — done
        }, 250)
        ceiling = window.setTimeout(finish, speechCeilingMs(text))
      })

    void (async () => {
      try {
        synth?.cancel()
        await wait(60)

        for (let i = startIndex; i < steps.length; i++) {
          if (token !== tokenRef.current) return
          stepRef.current = i
          onActiveStepChange(i)
          const step = steps[i]

          if (step.kind === 'move') {
            onApplyThroughPly(step.ply)   // idempotent in the parent
            await wait(MOVE_BEAT_MS)
            if (token !== tokenRef.current) return
          }

          if (step.text) {
            await narrate(step.text)
            if (token !== tokenRef.current) return
          }
        }

        if (token !== tokenRef.current) return
        stepRef.current = steps.length
        onActiveStepChange(null)
        setPhase('done')
        onFinished()
      } catch {
        if (token !== tokenRef.current) return
        onActiveStepChange(null)
        setPhase('done')
        onFinished()
      }
    })()
  }, [steps, onApplyThroughPly, onFinished, onActiveStepChange])

  const handlePlay = () => {
    onReset()
    stepRef.current = 0
    runFrom(0)
  }

  const handleResume = () => runFrom(stepRef.current)

  const handlePause = () => {
    tokenRef.current += 1
    window.speechSynthesis?.cancel()
    setPhase('paused')
  }

  const handleStop = () => {
    tokenRef.current += 1
    window.speechSynthesis?.cancel()
    stepRef.current = 0
    onActiveStepChange(null)
    setPhase('idle')
    onReset()
  }

  const nothingToRead = steps.length === 0
  const moveSteps = steps.filter(s => s.kind === 'move').length
  const movesDone = Math.min(
    stepRef.current - (steps[0]?.kind === 'story' ? 1 : 0) + 1,
    moveSteps,
  )

  const status = nothingToRead
    ? 'No guided commentary for this lesson.'
    : phase === 'playing'
      ? `Move ${Math.max(1, movesDone)} of ${moveSteps}${hasVoice ? ' — reading commentary aloud' : ' — commentary'}…`
      : phase === 'paused'
        ? 'Paused. Resume picks up at the current move.'
        : phase === 'done'
          ? 'Replay finished — your turn to find the move on the board.'
          : hasVoice
            ? 'Press Play to watch the game unfold move-by-move, with narration.'
            : 'Press Play to watch the game unfold move-by-move with commentary.'

  return (
    <div className="rounded-xl bg-gray-800 p-3 text-sm">
      <div className="flex flex-wrap gap-2">
        {(phase === 'idle' || phase === 'done') && (
          <button
            type="button"
            onClick={handlePlay}
            disabled={nothingToRead}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white enabled:hover:bg-emerald-500 disabled:opacity-40"
          >
            {phase === 'done' ? '↻ Replay' : '▶ Play'}
          </button>
        )}
        {phase === 'playing' && (
          <button
            type="button"
            onClick={handlePause}
            className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-500"
          >
            ‖ Pause
          </button>
        )}
        {phase === 'paused' && (
          <button
            type="button"
            onClick={handleResume}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500"
          >
            ▶ Resume
          </button>
        )}
        {(phase === 'playing' || phase === 'paused') && (
          <button
            type="button"
            onClick={handleStop}
            className="rounded-lg bg-gray-600 px-3 py-1.5 font-semibold text-white hover:bg-gray-500"
          >
            ■ Stop
          </button>
        )}
      </div>
      <p className="mt-2 text-gray-400" aria-live="polite">{status}</p>
    </div>
  )
}
