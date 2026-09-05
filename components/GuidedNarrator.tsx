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

// How long to hold on a commentary line. Paced to *reading* speed, not
// speaking speed — the line is on screen, highlighted; the audio is a
// bonus layer that may run a little past this. Keeps a 20-move
// walkthrough to ~90s instead of ~3min.
function dwellMs(text: string): number {
  return Math.min(4800, Math.max(1500, text.length * 38))
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

    // Read a line aloud if we can, but the timeline is driven by reading
    // speed (dwellMs), NOT by waiting for the utterance. Edge's Online
    // (Natural) voices frequently never fire `onend`, which used to stall
    // every step for seconds — now `onend` only advances *early*, and the
    // dwell timer guarantees a steady pace whatever the engine does.
    const narrate = (text: string) =>
      new Promise<void>(resolve => {
        let settled = false
        const done = () => { if (!settled) { settled = true; resolve() } }

        if (synth && voiceRef.current) {
          try {
            synth.cancel() // drop anything still queued from the previous line
            const u = new SpeechSynthesisUtterance(text)
            try { u.voice = voiceRef.current } catch { /* default voice */ }
            u.lang = voiceRef.current.lang || 'en-US'
            u.rate = 1.05
            u.onend = done
            u.onerror = done
            synth.speak(u)
          } catch { /* fall through to the timer */ }
        }
        window.setTimeout(done, dwellMs(text))
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
