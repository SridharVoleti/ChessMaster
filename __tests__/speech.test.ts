import { pickNarrationVoice, narrationVoiceScore } from '../lib/speech'

describe('pickNarrationVoice', () => {
  it('prefers a Microsoft Online Natural en-IN voice (Edge) over plain voices', () => {
    const voices = [
      { name: 'Google US English', lang: 'en-US' },
      { name: 'Microsoft Neerja Online (Natural) - English (India)', lang: 'en-IN' },
      { name: 'Microsoft David - English (United States)', lang: 'en-US' },
    ]
    expect(pickNarrationVoice(voices)?.lang).toBe('en-IN')
  })

  it('falls back to any English voice when no natural/online voice exists', () => {
    const voices = [
      { name: 'Google Deutsch', lang: 'de-DE' },
      { name: 'Google US English', lang: 'en-US' },
    ]
    expect(pickNarrationVoice(voices)?.lang).toBe('en-US')
  })

  it('returns null when there is no English voice at all', () => {
    expect(pickNarrationVoice([{ name: 'x', lang: 'fr-FR' }])).toBeNull()
    expect(pickNarrationVoice([])).toBeNull()
  })

  it('scores en-IN natural online highest', () => {
    expect(narrationVoiceScore({ name: 'Foo Online (Natural)', lang: 'en-IN' })).toBe(130)
    expect(narrationVoiceScore({ name: 'Bar', lang: 'en-US' })).toBe(50)
    expect(narrationVoiceScore({ name: 'Baz', lang: 'fr-FR' })).toBe(0)
  })
})
