import type { SignalScores } from '../report/scores.js'

const GENERIC_QUESTIONS = [
  'Tell me about yourself and why you are interested in this {role} position.',
  'Describe a challenging situation you faced in a {role} context and how you handled it.',
  'What do you consider your greatest strength relevant to working as a {role}?',
  'Tell me about a time you had to learn something new quickly for a {role} task.',
  'Where do you see yourself growing in the {role} field over the next few years?',
  'Describe a time you disagreed with a colleague while working as a {role}. What did you do?',
  'What daily habits help you stay effective in {role} work?',
]

export function templateQuestions(roleField: string, count: number): string[] {
  return GENERIC_QUESTIONS.slice(0, count).map((q) => q.replaceAll('{role}', roleField))
}

function band(score: number): 'strong' | 'okay' | 'needs work' {
  if (score >= 75) return 'strong'
  if (score >= 50) return 'okay'
  return 'needs work'
}

export function templateCoaching(scores: SignalScores): string {
  const rows = [
    ['Facial expression & composure', scores.expression],
    ['Eye contact', scores.eyeContact],
    ['Stillness (low fidgeting)', scores.stillness],
    ['Voice delivery', scores.voice],
    ['Speech clarity & fluency', scores.speech],
  ] as const

  const strengths = rows.filter(([, s]) => band(s) === 'strong')
  const improve = rows.filter(([, s]) => band(s) !== 'strong')

  return [
    '## Strengths',
    strengths.length
      ? strengths.map(([n, s]) => `- **${n}** (${s}/100) — keep doing what you are doing here.`).join('\n')
      : '- You completed the full session — that consistency is the foundation to build on.',
    '',
    '## Areas to Improve',
    improve.length
      ? improve.map(([n, s]) => `- **${n}** (${s}/100) — ${band(s) === 'okay' ? 'solid, with room to polish.' : 'focus your next practice sessions here.'}`).join('\n')
      : '- All signals look strong. Try a harder question set next time.',
    '',
    '## Practice Tips',
    '- Practice answering while looking directly at your camera lens, not the screen.',
    '- Record 2-minute answers and listen for pace: aim for 120-150 words per minute.',
    '- Pause deliberately instead of using filler words; a short silence reads as confidence.',
    '- Keep hands rested and visible; ground your posture before each answer.',
    '',
    '_This report is a training aid. It measures delivery signals only — it is not an evaluation of you or your answers._',
  ].join('\n')
}
