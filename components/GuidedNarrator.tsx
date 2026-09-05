'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { pickNarrationVoice } from '@/lib/speech'
import type { GuidedStep } from '@/lib/narration'

// ── Guided replay control ────────────────────────────────────────
// Walks a lesson's steps (story, then one per commentary line) and
// keeps the board and the spoken commentary in lock-step:
//
//   play the move  →  speak its commentary  →  play the next move …
//
// The move for a step is applied by the parent (onApplyThroughPly)
// *before* its line is spoken, and the parent's apply is idempotent so
// Resume can safely re-run the current step. When every step is done,
// onFinished() hands control back to the board for the student's turn.
//
// Speech uses the same Edge-tuned setup as NarrationPlayer: prefer
// Microsoft "Online (Natural)" en voices, wait for `voiceschanged`,
// one utterance per line, Pause = cancel + Resume re-speaks the line.

const MOVE_BEAT_MS = 420 // let a move land visually before its line is read
const BETWEEN_MS   = 140 // small breath between a line and the next move

type Phase = 'loading-voice' | 'unsupported' | 'idle' | 'playing' | 'paused' | 'done'

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
  const [phase, setPhase] = useState<Phase>('loading-voice')
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const stepRef  = useRef(0)
  // bumped on every stop/pause/reset/unmount so a stale async loop bails
  const tokenRef = useRef(0)

  // ── Voice loading (Edge populates the list asynchronously) ──────
  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!synth) { setPhase('unsupported'); return }

    const refresh = () => {
      voiceRef.current = pickNarrationVoice(synth.getVoices())
      setPhase(prev => (prev === 'loading-voice' && voiceRef.current ? 'idle' : prev))
    }
    refresh()
    synth.addEventListener('voiceschanged', refresh)
    const t1 = window.setTimeout(refresh, 250)
    const t2 = window.setTimeout(refresh, 1500)

    return () => {
      synth.removeEventListener('voiceschanged', refresh)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
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
    setPhase(prev => (prev === 'unsupported' || prev === 'loading-voice' ? prev : 'idle'))
  }, [resetKey, onActiveStepChange])

  const runFrom = useCallback((startIndex: number) => {
    const synth = window.speechSynthesis
    if (!synth || !voiceRef.current) return
    const token = ++tokenRef.current
    setPhase('playing')

    const speak = (text: string) =>
      new Promise<void>(resolve => {
        let settled = false
        const done = () => { if (!settled) { settled = true; resolve() } }
        try {
          const u = new SpeechSynthesisUtterance(text)
          try { u.voice = voiceRef.current } catch { /* keep default voice */ }
          u.lang = voiceRef.current?.lang || 'en-US'
          u.rate = 1.05
          u.onend = done
          u.onerror = done
          synth.speak(u)
          // safety net: never hang a step if the engine drops the utterance
          window.setTimeout(done, Math.max(4000, text.length * 90))
        } catch {
          done()
        }
      })

    const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms))

    void (async () => {
      try {
        synth.cancel()
        await wait(60) // let the cancel settle before queueing (Edge quirk)

        for (let i = startIndex; i < steps.length; i++) {
          if (token !== tokenRef.current) return
          stepRef.current = i
          onActiveStepChange(i)
          const step = steps[i]

          if (step.kind === 'move') {
            onApplyThroughPly(step.ply)     // idempotent in the parent
            await wait(MOVE_BEAT_MS)
            if (token !== tokenRef.current) return
          }

          if (step.text) {
            await speak(step.text)
            if (token !== tokenRef.current) return
            await wait(BETWEEN_MS)
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
        // Unexpected failure mid-replay: don't strand the UI on "playing".
        // Jump straight to the student's turn — the board catches up.
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

  const status =
    phase === 'unsupported'
      ? 'Guided read-aloud needs speech support — open this in Microsoft Edge.'
      : phase === 'loading-voice'
        ? 'Preparing the narration voice…'
        : nothingToRead
          ? 'No guided commentary for this lesson.'
          : phase === 'playing'
            ? `Playing move ${Math.max(1, movesDone)} of ${moveSteps} with commentary…`
            : phase === 'paused'
              ? 'Paused. Resume replays the current move’s commentary.'
              : phase === 'done'
                ? 'Replay finished — your turn to find the move on the board.'
                : 'Press Play to watch the game unfold move-by-move with commentary.'

  return (
    <div className="rounded-xl bg-gray-800 p-3 text-sm">
      <div className="flex flex-wrap gap-2">
        {(phase === 'idle' || phase === 'done' || phase === 'unsupported' || phase === 'loading-voice') && (
          <button
            type="button"
            onClick={handlePlay}
            disabled={phase === 'unsupported' || phase === 'loading-voice' || nothingToRead}
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
