import { countFillers, countWords } from './fillers.js'

export interface SpeechDelta {
  text: string
  words: number
  fillers: number
}

// Web Speech API wrapper (R5). Live transcript is unavailable on iOS
// Safari — callers degrade gracefully (report transcript unaffected).
export class SpeechRecognizer {
  private recognition: any = null
  private stopped = false
  onDelta: ((delta: SpeechDelta) => void) | null = null

  static supported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  }

  start() {
    const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!Ctor) return
    this.stopped = false
    this.recognition = new Ctor()
    this.recognition.continuous = true
    this.recognition.interimResults = false
    this.recognition.lang = 'en-US'

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript as string
          this.onDelta?.({ text, words: countWords(text), fillers: countFillers(text) })
        }
      }
    }
    // Chrome stops recognition after silence; restart until told to stop
    this.recognition.onend = () => {
      if (!this.stopped) {
        try {
          this.recognition.start()
        } catch {
          /* already started */
        }
      }
    }
    try {
      this.recognition.start()
    } catch {
      /* already started */
    }
  }

  stop() {
    this.stopped = true
    this.recognition?.stop()
    this.recognition = null
  }
}
