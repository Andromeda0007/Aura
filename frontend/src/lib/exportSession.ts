import type { AIResponse } from '@/types'

interface TranscriptEntry {
  id: string
  text: string
  timestamp: string
  isFinal: boolean
}

interface ExportOptions {
  subject: string
  date: string
  transcripts: TranscriptEntry[]
  aiHistory: AIResponse[]
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function responseToMarkdown(r: AIResponse): string {
  const d = r.data
  if (!d) return ''
  const lines: string[] = []

  if (r.command) lines.push(`> ${r.command}`)
  lines.push('')

  if (d.answer)      lines.push(d.answer)
  if (d.summary)     lines.push(d.summary)
  if (d.explanation) lines.push(d.explanation)

  if (Array.isArray(d.questions)) {
    d.questions.forEach((q: any, i: number) => {
      lines.push(`**Q${i + 1}.** ${q.question}`)
      if (Array.isArray(q.options)) {
        q.options.forEach((opt: string, j: number) => {
          const letter = String.fromCharCode(65 + j)
          lines.push(`  ${letter}. ${opt}`)
        })
      }
      if (q.answer) lines.push(`  *Answer: ${q.answer}*`)
      lines.push('')
    })
  }

  if (d.description) lines.push(d.description)
  if (d.example)     lines.push(`**Example:** ${d.example}`)

  return lines.join('\n')
}

export function exportSession({ subject, date, transcripts, aiHistory }: ExportOptions) {
  const dateStr = new Date(date).toLocaleDateString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const sections: string[] = [
    `# ${subject}`,
    `**Date:** ${dateStr}`,
    '',
    '---',
    '',
  ]

  // Transcript section
  const finalTranscripts = transcripts.filter(t => t.isFinal && !t.text.startsWith('Listening'))
  if (finalTranscripts.length > 0) {
    sections.push('## Transcript')
    sections.push('')
    finalTranscripts.forEach(t => {
      sections.push(`**${formatTime(t.timestamp)}** ${t.text}`)
    })
    sections.push('')
    sections.push('---')
    sections.push('')
  }

  // AI responses section
  if (aiHistory.length > 0) {
    sections.push('## Aura AI Responses')
    sections.push('')
    aiHistory.forEach((r, i) => {
      sections.push(`### ${i + 1}. ${r.type ?? 'Response'} — ${formatTime(r.timestamp)}`)
      sections.push('')
      sections.push(responseToMarkdown(r))
      sections.push('')
    })
  }

  const content = sections.join('\n')
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${subject.replace(/\s+/g, '_')}_${new Date(date).toISOString().slice(0, 10)}.md`
  a.click()
  URL.revokeObjectURL(url)
}
