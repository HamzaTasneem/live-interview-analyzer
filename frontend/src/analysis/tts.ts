// Spoken interviewer (F5) via the browser SpeechSynthesis API.
export class Interviewer {
  enabled = true

  static supported(): boolean {
    return 'speechSynthesis' in window
  }

  speak(text: string) {
    if (!this.enabled || !Interviewer.supported()) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.95
    // Prefer a natural en voice when available
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.startsWith('en') && v.localService)
    if (voice) utterance.voice = voice
    window.speechSynthesis.speak(utterance)
  }

  stop() {
    if (Interviewer.supported()) window.speechSynthesis.cancel()
  }
}
