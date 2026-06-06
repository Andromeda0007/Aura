'use client'

import { Brain, ClipboardPaste, X } from 'lucide-react'

interface AIPasteCardProps {
  title: string
  preview: string
  onPaste: () => void
  onDismiss: () => void
}

export function AIPasteCard({ title, preview, onPaste, onDismiss }: AIPasteCardProps) {
  return (
    <div className="absolute bottom-16 left-4 z-20 w-80 bg-dark-800 border border-primary-500/40 rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-700">
        <div className="w-5 h-5 rounded bg-primary-500/20 flex items-center justify-center">
          <Brain className="w-3 h-3 text-primary-400" />
        </div>
        <span className="text-xs font-semibold text-primary-300 flex-1 truncate">{title}</span>
        <button
          onClick={onDismiss}
          className="text-dark-500 hover:text-dark-200 transition-colors p-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-2 max-h-36 overflow-y-auto">
        <p className="text-xs text-dark-200 leading-relaxed whitespace-pre-wrap">{preview}</p>
      </div>

      <div className="px-3 py-2 border-t border-dark-700 flex gap-2">
        <button
          onClick={onPaste}
          className="flex-1 flex items-center justify-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
        >
          <ClipboardPaste className="w-3 h-3" />
          Paste to Board
        </button>
        <button
          onClick={onDismiss}
          className="text-xs text-dark-400 hover:text-dark-200 py-1.5 px-3 rounded-lg border border-dark-600 hover:border-dark-500 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
