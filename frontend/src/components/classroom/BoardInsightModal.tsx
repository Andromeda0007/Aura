'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, Plus, X, RotateCcw, Brain } from 'lucide-react'
import type { BoardInsight } from '@/types'

interface BoardInsightNotificationProps {
  insight: BoardInsight
  onReview: () => void
  onDismiss: () => void
}

/** Slim notification bar that sits above the whiteboard toolbar */
export function BoardInsightNotification({ insight, onReview, onDismiss }: BoardInsightNotificationProps) {
  const preview = insight.description.slice(0, 80) + (insight.description.length > 80 ? '…' : '')

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-dark-800 border border-indigo-500/40 rounded-full pl-3 pr-2 py-1.5 shadow-lg max-w-lg w-full mx-4">
      <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 animate-pulse" />
      <span className="text-xs text-dark-200 flex-1 truncate">{preview}</span>
      <button
        onClick={onReview}
        className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-2.5 py-1 rounded-full transition-colors shrink-0 flex items-center gap-1"
      >
        <Eye className="w-3 h-3" />
        Review
      </button>
      <button
        onClick={onDismiss}
        className="text-dark-400 hover:text-dark-200 transition-colors p-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

interface BoardInsightModalProps {
  insight: BoardInsight
  confirmedCount: number
  onAskAura: (command: string) => void
  onConfirm: () => void
  onDismiss: () => void
  onUndo: () => void
  showUndo: boolean
}

/** Full modal — shows Gemini's description + action buttons */
export function BoardInsightModal({
  insight,
  confirmedCount,
  onAskAura,
  onConfirm,
  onDismiss,
  onUndo,
  showUndo,
}: BoardInsightModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-dark-700">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Brain className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest">Board Intelligence</p>
            <p className="text-xs text-dark-400">Aura read the whiteboard</p>
          </div>
          <button onClick={onDismiss} className="text-dark-500 hover:text-dark-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold text-dark-500 uppercase tracking-widest mb-1.5">What Aura sees</p>
          <div className="bg-dark-900 rounded-xl border border-dark-700 p-3 max-h-48 overflow-y-auto">
            <p className="text-sm text-dark-100 leading-relaxed whitespace-pre-wrap">{insight.description}</p>
          </div>
        </div>

        {/* Confirmed count badge */}
        {confirmedCount > 0 && (
          <div className="px-4 pb-1">
            <p className="text-[10px] text-dark-500">
              {confirmedCount} insight{confirmedCount !== 1 ? 's' : ''} already added to AI context
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="px-4 py-3 border-t border-dark-700 flex flex-col gap-2">
          <div className="flex gap-2">
            {/* Ask Aura — sends as a voice command, response appears in AI panel */}
            <button
              onClick={() => onAskAura(`hey aura explain what's currently on the board`)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium py-2 rounded-xl transition-colors"
            >
              <Brain className="w-3.5 h-3.5" />
              Ask Aura to explain
            </button>

            {/* Add to context — stores for future commands */}
            <button
              onClick={onConfirm}
              className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium py-2 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add to AI context
            </button>
          </div>

          <div className="flex gap-2">
            {showUndo && (
              <button
                onClick={onUndo}
                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400/50 rounded-xl px-3 py-1.5 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Undo last add
              </button>
            )}
            <button
              onClick={onDismiss}
              className="flex-1 text-xs text-dark-400 hover:text-dark-200 py-1.5 rounded-xl transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
