// ── Narration voice selection ────────────────────────────────────
// Shared by the read-aloud controls (NarrationPlayer, GuidedNarrator).
// Prefers Microsoft's "Online (Natural)" English voices, which only
// exist in Microsoft Edge; falls back to any English voice elsewhere.

interface VoiceLike {
  name?: string
  lang?: string
}

export function narrationVoiceScore(voice: VoiceLike): number {
  const name = String(voice.name || '').toLowerCase()
  const lang = String(voice.lang || '').toLowerCase()
  let value = 0
  if (lang.startsWith('en-in')) value += 100
  else if (lang.startsWith('en-gb')) value += 60
  else if (lang.startsWith('en-us')) value += 50
  else if (lang.startsWith('en')) value += 30
  if (name.includes('natural')) value += 20
  if (name.includes('online')) value += 10
  return value
}

/** Highest-scoring English voice, or null if the list has none. */
export function pickNarrationVoice<T extends VoiceLike>(voices: T[]): T | null {
  const ranked = voices.slice().sort((a, b) => narrationVoiceScore(b) - narrationVoiceScore(a))
  return ranked.find(v => String(v.lang || '').toLowerCase().startsWith('en')) ?? null
}
