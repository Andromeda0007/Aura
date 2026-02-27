'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb, BookOpen, MessageCircle, Send, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '../shared/Button'
import { useSessionStore } from '@/store/sessionStore'
import { api } from '@/lib/api'

interface ExplanationDisplayProps {
  data: {
    // explanation / answer shape
    content?: string
    title?: string
    // example/problem shape
    problem?: string
    correctAnswer?: string
    explanation?: string
  }
  type: 'explanation' | 'example' | 'answer'
}

type ValidationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'correct';  feedback: string }
  | { status: 'wrong';    feedback: string }

export function ExplanationDisplay({ data, type }: ExplanationDisplayProps) {
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
              <p className="text-[10px] text-dark-500">Press Enter to submit · Aura will check your work</p>
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
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          type === 'explanation'
            ? 'bg-green-500/15 border border-green-500/30 text-green-400'
            : 'bg-sky-500/15 border border-sky-500/30 text-sky-400'
        }`}>
          {getIcon()}
        </div>
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${
            type === 'explanation' ? 'text-green-400' : 'text-sky-400'
          }`}>{getLabel()}</p>
          {data.title && <h3 className="text-sm font-bold text-dark-50">{data.title}</h3>}
        </div>
      </div>

      <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-4">
        <p className="text-dark-100 text-sm leading-relaxed whitespace-pre-wrap">
          {data.content ?? data.explanation ?? ''}
        </p>
      </div>
    </div>
  )
}
