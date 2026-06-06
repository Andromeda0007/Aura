'use client'

import { useEffect, useRef } from 'react'
import { Mic, FileText, X, Loader2, ClipboardList } from 'lucide-react'
import { formatTimeWithSecondsIST } from '@/lib/dateUtils'

interface TranscriptEntry {
  id: string
  text: string
  timestamp: string
  isFinal: boolean
}

interface LiveTranscriptProps {
  entries: TranscriptEntry[]
  isRecording: boolean
  isOpen: boolean
  onToggle: () => void
  onSummarizeToCanvas?: () => void
  isSummarizing?: boolean
}

export function LiveTranscript({ entries, isRecording, isOpen, onToggle, onSummarizeToCanvas, isSummarizing }: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, isOpen])

  if (!isOpen) return null

  const interimEntry = entries.find(e => e.id === 'live-interim')
  const finalEntries = entries.filter(e => e.id !== 'live-interim')
  const hasContent   = finalEntries.length > 0 || !!interimEntry

  return (
    <div className="fixed bottom-20 right-6 w-96 max-h-[520px] flex flex-col z-[9999] rounded-xl border border-dark-700 bg-dark-800 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
            </span>
          )}
          <FileText className="w-4 h-4 text-dark-300" />
          <span className="text-sm font-semibold text-dark-50">Live Transcript</span>
        </div>
        <button onClick={onToggle} className="p-1 rounded hover:bg-dark-700 transition-colors">
          <X className="w-4 h-4 text-dark-400 hover:text-dark-50" />
        </button>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: '380px' }}>
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-lg bg-dark-700 border border-dark-600 mb-3">
              <Mic className="w-5 h-5 text-dark-400" />
            </div>
            <p className="text-sm text-dark-300">{isRecording ? 'Listening…' : 'No transcript yet'}</p>
            <p className="text-xs text-dark-500 mt-1">Start recording to see live transcript</p>
          </div>
        ) : (
          <>
            {finalEntries.map((entry) => (
              <div key={entry.id} className="group">
                <p className="text-sm text-dark-50 leading-relaxed">{entry.text}</p>
                <span className="text-[11px] text-dark-500">
                  {formatTimeWithSecondsIST(entry.timestamp)}
                </span>
              </div>
            ))}
            {interimEntry && (
              <div className="border-l-2 border-primary-500/60 pl-3">
                <p className="text-sm text-dark-300 italic leading-relaxed">{interimEntry.text}</p>
                <span className="text-[11px] text-primary-500/70">live…</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-dark-700 flex items-center justify-between gap-2">
        <p className="text-[11px] text-dark-500">
          {finalEntries.length} {finalEntries.length === 1 ? 'sentence' : 'sentences'} transcribed
        </p>
        {onSummarizeToCanvas && hasContent && (
          <button
            onClick={onSummarizeToCanvas}
            disabled={isSummarizing}
            className="flex items-center gap-1.5 text-xs bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSummarizing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <ClipboardList className="w-3.5 h-3.5" />}
            {isSummarizing ? 'Summarizing…' : 'Summarize to Board'}
          </button>
        )}
      </div>
    </div>
  )
}
