// Filler-word counting over live transcript deltas (R5).

const FILLER_PATTERNS = [
  /\bum+\b/gi,
  /\buh+\b/gi,
  /\ber+m?\b/gi,
  /\bhmm+\b/gi,
  /\blike\b/gi,
  /\byou know\b/gi,
  /\bbasically\b/gi,
  /\bactually\b/gi,
  /\bkind of\b/gi,
  /\bsort of\b/gi,
  /\bi mean\b/gi,
]

export function countFillers(text: string): number {
  let count = 0
  for (const pattern of FILLER_PATTERNS) {
    const matches = text.match(pattern)
    if (matches) count += matches.length
  }
  return count
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length
}
