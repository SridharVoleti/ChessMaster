'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { pickNarrationVoice } from '@/lib/speech'

// ── Read-aloud control ───────────────────────────────────────────
// Web Speech API (speechSynthesis) narration for a lesson's story +
// move commentary. Built the same way as the course reader:
//   • prefers Microsoft's "Online (Natural)" en voices, which only
//     exist in Edge — falls back to any en voice elsewhere
//   • waits for `voiceschanged` (Edge populates its voice list async)
//   • speaks one short segment per utterance and chains via `onend`
//     (avoids the ~15s Chromium/Edge cutoff on long utterances)
//   • Pause = cancel + remember index; Resume re-speaks from there,
//     because native pause()/resume() is unreliable with Edge's
//     online voices
//
// This is the plain monologue player used for story-only lessons.
// Module lessons with per-ply commentary use GuidedNarrator instead,
// which keeps the board move and its commentary in lock-step.

type PlayerState = 'idle' | 'playing' | 'paused' | 'unsupported' | 'loading-voice'

export function NarrationPlayer({ segments }: { segments: string[] }) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined

  const [player, setPlayer] = useState<PlayerState>(synth ? 'loading-voice' : 'unsupported')
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const indexRef = useRef(0)
  // bumped on every stop/pause/unmount so a stale `onend` can't resume playback
  const tokenRef = useRef(0)

  useEffect(() => {
    if (!synth) return

    const refresh = () => {
      voiceRef.current = pickNarrationVoice(synth.getVoices())
      setPlayer(prev =>
        prev === 'loading-voice' ? (voiceRef.current ? 'idle' : 'loading-voice') : prev,
      )
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
  }, [synth])

  // Reset when the lesson changes.
  useEffect(() => {
    tokenRef.current += 1
    indexRef.current = 0
    synth?.cancel()
    setPlayer(prev => (prev === 'unsupported' || prev === 'loading-voice' ? prev : 'idle'))
  }, [segments, synth])

  const speakFrom = useCallback(
    (start: number) => {
      if (!synth || !voiceRef.current) return
      const token = ++tokenRef.current
      indexRef.current = start
      setPlayer('playing')

      const speakNext = () => {
        if (token !== tokenRef.current) return
        if (indexRef.current >= segments.length) {
          setPlayer('idle')
          indexRef.current = 0
          return
        }
        const u = new SpeechSynthesisUtterance(segments[indexRef.current])
        u.voice = voiceRef.current
        u.lang = voiceRef.current!.lang || 'en-US'
        u.rate = 1.05
        u.onend = () => {
          if (token !== tokenRef.current) return
          indexRef.current += 1
          speakNext()
        }
        u.onerror = event => {
          if (token !== tokenRef.current) return
          if (event.error === 'interrupted' || event.error === 'canceled') return
          setPlayer('idle')
        }
        synth.speak(u)
      }

      synth.cancel()
      // let the cancel settle before queueing (Edge quirk)
      window.setTimeout(speakNext, 60)
    },
    [synth, segments],
  )

  const handlePlay = () => speakFrom(0)
  const handleResume = () => speakFrom(indexRef.current)

  const handlePause = () => {
    if (!synth) return
    tokenRef.current += 1 // stop the onend chain
    synth.cancel()
    setPlayer('paused')
  }

  const handleStop = () => {
    if (!synth) return
    tokenRef.current += 1
    synth.cancel()
    indexRef.current = 0
    setPlayer('idle')
  }

  const nothingToRead = segments.length === 0

  const status =
    player === 'unsupported'
      ? 'Read-aloud needs a browser with speech support — open this in Microsoft Edge.'
      : player === 'loading-voice'
        ? 'Preparing the narration voice…'
        : nothingToRead
          ? 'No narration for this lesson.'
          : player === 'playing'
            ? `Reading… (${Math.min(indexRef.current + 1, segments.length)}/${segments.length})`
            : player === 'paused'
              ? 'Paused.'
              : 'Ready to read the story and commentary aloud.'

  return (
    <div className="rounded-xl bg-gray-800 p-3 text-sm">
      <div className="flex flex-wrap gap-2">
        {player !== 'playing' && player !== 'paused' && (
          <button
            type="button"
            onClick={handlePlay}
            disabled={player === 'unsupported' || player === 'loading-voice' || nothingToRead}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white enabled:hover:bg-emerald-500 disabled:opacity-40"
          >
            ▶ Play
          </button>
        )}
        {player === 'playing' && (
          <button
            type="button"
            onClick={handlePause}
            className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-500"
          >
            ‖ Pause
          </button>
        )}
        {player === 'paused' && (
          <button
            type="button"
            onClick={handleResume}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500"
          >
            ▶ Resume
          </button>
        )}
        {(player === 'playing' || player === 'paused') && (
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
