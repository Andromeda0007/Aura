'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb, BookOpen, MessageCircle, Send, CheckCircle2, XCircle, Loader2, LayoutPanelLeft, Network } from 'lucide-react'
import { Button } from '../shared/Button'
import { useSessionStore } from '@/store/sessionStore'
import { api } from '@/lib/api'
import { config } from '@/lib/constants'

interface ExplanationDisplayProps {
  data: {
    content?: string
    title?: string
    definition?: string
    explanation?: string
    nextTopics?: string[]
    nextQuestions?: string[]
    formattedText?: string
    // example/problem shape
    problem?: string
    correctAnswer?: string
  }
  type: 'explanation' | 'example' | 'answer'
  onTopicClick?: (topic: string) => void
  onPasteToCanvas?: (text: string) => void
  onGenerateDiagram?: (topic: string) => void
}

type ValidationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'correct';  feedback: string }
  | { status: 'wrong';    feedback: string }

export function ExplanationDisplay({ data, type, onTopicClick, onPasteToCanvas, onGenerateDiagram }: ExplanationDisplayProps) {
  const { currentSession } = useSessionStore()
  const [answer, setAnswer] = useState('')
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle' })
  const [showExplanation, setShowExplanation] = useState(false)

  const isProblem = type === 'example' && !!data.problem

  const getIcon = () => {
    switch (type) {
      case 'explanation': return <BookOpen className="w-4 h-4" />
      case 'example':     return <Lightbulb className="w-4 h-4" />
      case 'answer':      return <MessageCircle className="w-4 h-4" />
    }
  }

  const getLabel = () => {
    if (isProblem) return 'Problem'
    switch (type) {
      case 'explanation': return 'Explanation'
      case 'example':     return 'Example'
      case 'answer':      return 'Answer'
    }
  }

  const handleValidate = async () => {
    if (!answer.trim() || !currentSession?.id) return
    setValidation({ status: 'loading' })
    try {
      const result = await api.validateAnswer(
        currentSession.id,
        data.problem!,
        data.correctAnswer!,
        answer.trim(),
      )
      setValidation({
        status: result.isCorrect ? 'correct' : 'wrong',
        feedback: result.feedback,
      })
      if (result.isCorrect) setShowExplanation(true)
    } catch {
      setValidation({ status: 'wrong', feedback: 'Could not validate. Please try again.' })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleValidate()
    }
  }

  const resetValidation = () => {
    setValidation({ status: 'idle' })
    setAnswer('')
    setShowExplanation(false)
  }

  // ── Problem / interactive mode ──────────────────────────────
  if (isProblem) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">Problem</p>
            {data.title && <h3 className="text-sm font-bold text-dark-50">{data.title}</h3>}
          </div>
        </div>

        {/* Problem statement */}
        <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-4">
          <p className="text-dark-100 text-sm leading-relaxed whitespace-pre-wrap">{data.problem}</p>
        </div>

        {/* Answer input */}
        <AnimatePresence mode="wait">
          {validation.status === 'idle' || validation.status === 'loading' ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-2"
            >
              <label className="text-xs text-dark-300 font-medium">Your answer</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your answer here…"
                  disabled={validation.status === 'loading'}
                  className="flex-1 h-9 bg-dark-700 border border-dark-600 rounded-lg px-3 text-sm text-dark-50 placeholder-dark-500 focus:outline-none focus:border-primary-500 disabled:opacity-50 transition-colors"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleValidate}
                  disabled={!answer.trim() || validation.status === 'loading'}
                  className="h-9 px-3"
                >
                  {validation.status === 'loading' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-dark-500">Press Enter to submit · {config.appName} will check your work</p>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-3"
            >
              {/* Result banner */}
              <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                validation.status === 'correct'
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                {validation.status === 'correct' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${validation.status === 'correct' ? 'text-green-300' : 'text-red-300'}`}>
                    {validation.status === 'correct' ? 'Correct!' : 'Not quite'}
                  </p>
                  <p className="text-xs text-dark-200 mt-0.5 leading-relaxed">{validation.feedback}</p>
                </div>
              </div>

              {/* Show / hide explanation */}
              <button
                onClick={() => setShowExplanation(!showExplanation)}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors underline underline-offset-2"
              >
                {showExplanation ? 'Hide explanation' : 'Show step-by-step solution'}
              </button>

              <AnimatePresence>
                {showExplanation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-400 mb-2">Solution</p>
                      <p className="text-dark-200 text-sm leading-relaxed whitespace-pre-wrap">{data.explanation}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Try again */}
              <button
                onClick={resetValidation}
                className="text-xs text-dark-500 hover:text-dark-300 transition-colors"
              >
                ↩ Try a different answer
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ── Standard explanation / answer mode ──────────────────────
  const accentColor = type === 'explanation' ? 'text-green-400' : 'text-sky-400'
  const bodyText    = data.formattedText ?? data.content ?? data.explanation ?? ''

  const pasteText = [data.definition, data.explanation ?? bodyText]
    .filter(Boolean).join('\n\n').trim()

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          type === 'explanation'
            ? 'bg-green-500/15 border border-green-500/30 text-green-400'
            : 'bg-sky-500/15 border border-sky-500/30 text-sky-400'
        }`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${accentColor}`}>{getLabel()}</p>
          {data.title && <h3 className="text-sm font-bold text-dark-50 truncate">{data.title}</h3>}
        </div>
      </div>

      {/* Definition */}
      {data.definition && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-green-400 mb-1.5">Definition</p>
          <p className="text-dark-50 text-sm font-medium leading-relaxed">{data.definition}</p>
        </div>
      )}

      {/* Divider between definition and explanation */}
      {data.definition && (data.explanation || bodyText) && (
        <div className="h-px bg-dark-700" />
      )}

      {/* Explanation */}
      {(data.explanation || bodyText) && (
        <div>
          {data.definition && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-400 mb-1.5">Explanation</p>
          )}
          <p className="text-dark-100 text-sm leading-relaxed whitespace-pre-wrap">
            {data.explanation ?? bodyText}
          </p>
        </div>
      )}

      {/* Next topics chips */}
      {data.nextTopics && data.nextTopics.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-2">
            Cover Next {onTopicClick && <span className="normal-case font-normal text-dark-500 ml-1">· tap to explore</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.nextTopics.map((topic, i) => (
              onTopicClick ? (
                <button key={i} onClick={() => onTopicClick(topic)}
                  className="text-xs bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/30 hover:border-indigo-400/60 text-indigo-300 px-2.5 py-1 rounded-full transition-colors">
                  {topic}
                </button>
              ) : (
                <span key={i} className="text-xs bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 px-2.5 py-1 rounded-full">
                  {topic}
                </span>
              )
            ))}
          </div>
        </div>
      )}

      {/* Next questions */}
      {data.nextQuestions && data.nextQuestions.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-400 mb-2">Students Will Ask</p>
          <div className="space-y-1.5">
            {data.nextQuestions.map((q, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-primary-400 text-sm mt-0.5 shrink-0">?</span>
                <p className="text-xs text-dark-200 leading-relaxed">{q}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(onPasteToCanvas || onGenerateDiagram) && (
        <div className="pt-1 border-t border-dark-700 flex gap-2">
          {onPasteToCanvas && pasteText && (
            <button
              onClick={() => onPasteToCanvas(pasteText)}
              className="flex-1 flex items-center gap-2 justify-center text-xs bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 px-3 py-2 rounded-lg transition-colors"
            >
              <LayoutPanelLeft className="w-3.5 h-3.5" />
              Paste to Canvas
            </button>
          )}
          {onGenerateDiagram && data.title && (
            <button
              onClick={() => onGenerateDiagram(data.title!)}
              className="flex-1 flex items-center gap-2 justify-center text-xs bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 px-3 py-2 rounded-lg transition-colors"
            >
              <Network className="w-3.5 h-3.5" />
              Diagram
            </button>
          )}
        </div>
      )}
    </div>
  )
}
