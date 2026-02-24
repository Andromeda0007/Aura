'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Circle } from 'lucide-react'
import type { QuizData } from '@/types'

interface QuizDisplayProps {
  data: QuizData
}

export function QuizDisplay({ data }: QuizDisplayProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})

  const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
    // Lock the answer once selected — no changing
    if (selectedAnswers[questionIndex] !== undefined) return
    setSelectedAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }))
  }

  const answered  = Object.keys(selectedAnswers).length
  const total     = data.questions.length
  const correct   = data.questions.filter((q, i) => selectedAnswers[i] === q.correctAnswer).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-[#DFDFD6]">{data.title || 'Quiz'}</h3>
          <p className="text-sm text-[#DFDFD6]/50 mt-0.5">
            {total} questions{data.timeLimit ? ` • ${data.timeLimit} min` : ''}
          </p>
        </div>
        {answered > 0 && (
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-[#DFDFD6]">
              {correct}/{answered} correct
            </p>
            <p className="text-xs text-[#DFDFD6]/50">{answered}/{total} answered</p>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {data.questions.map((question, qIndex) => {
          const selected   = selectedAnswers[qIndex]
          const hasAnswered = selected !== undefined
          const isRight    = hasAnswered && selected === question.correctAnswer

          return (
            <div
              key={qIndex}
              className="rounded-xl border border-[#F56565]/20 bg-[#202127] p-4 space-y-3"
            >
              {/* Question text */}
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-[#F56565] mt-0.5 shrink-0">
                  Q{qIndex + 1}
                </span>
                <p className="text-sm text-[#DFDFD6] leading-snug">{question.question}</p>
              </div>

              {/* Options */}
              <div className="space-y-2">
                {question.options.map((option, oIndex) => {
                  const isSelected = selected === oIndex
                  const isCorrectOption = oIndex === question.correctAnswer

                  let borderColor = 'border-[#DFDFD6]/10'
                  let bgColor     = 'bg-[#1B1B1F]'
                  let textColor   = 'text-[#DFDFD6]/70'
                  let icon        = <Circle className="w-4 h-4 text-[#DFDFD6]/30 shrink-0 mt-0.5" />

                  if (hasAnswered) {
                    if (isCorrectOption) {
                      borderColor = 'border-green-500/60'
                      bgColor     = 'bg-green-500/10'
                      textColor   = 'text-green-400'
                      icon        = <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    } else if (isSelected && !isCorrectOption) {
                      borderColor = 'border-[#F56565]/60'
                      bgColor     = 'bg-[#F56565]/10'
                      textColor   = 'text-[#F56565]'
                      icon        = <XCircle className="w-4 h-4 text-[#F56565] shrink-0 mt-0.5" />
                    }
                  } else if (isSelected) {
                    borderColor = 'border-[#F56565]/60'
                    bgColor     = 'bg-[#F56565]/10'
                    textColor   = 'text-[#DFDFD6]'
                    icon        = <CheckCircle className="w-4 h-4 text-[#F56565] shrink-0 mt-0.5" />
                  }

                  return (
                    <button
                      key={oIndex}
                      onClick={() => handleSelectAnswer(qIndex, oIndex)}
                      disabled={hasAnswered}
                      className={`w-full text-left p-3 rounded-lg border transition-all
                        ${borderColor} ${bgColor}
                        ${!hasAnswered ? 'hover:border-[#F56565]/40 cursor-pointer' : 'cursor-default'}
                      `}
                    >
                      <div className="flex items-start gap-2.5">
                        {icon}
                        <span className={`text-sm ${textColor}`}>{option}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Feedback + Explanation — shows after answering */}
              {hasAnswered && (
                <div
                  className={`rounded-lg p-3 border text-sm ${
                    isRight
                      ? 'bg-green-500/10 border-green-500/30 text-green-400'
                      : 'bg-[#F56565]/10 border-[#F56565]/30 text-[#F56565]'
                  }`}
                >
                  <p className="font-semibold mb-1">
                    {isRight ? '✓ Correct!' : '✗ Wrong answer'}
                  </p>
                  {question.explanation && (
                    <p className="text-[#DFDFD6]/70 text-xs leading-relaxed">
                      {question.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Final score — shows when all answered */}
      {answered === total && total > 0 && (
        <div className="rounded-xl border border-[#F56565]/30 bg-[#202127] p-4 text-center">
          <p className="text-2xl font-bold text-[#DFDFD6]">
            {correct}/{total}
          </p>
          <p className="text-sm text-[#DFDFD6]/50 mt-1">
            {Math.round((correct / total) * 100)}% — {
              correct === total ? 'Perfect score! 🎉' :
              correct >= total * 0.7 ? 'Good job!' :
              'Keep practising.'
            }
          </p>
        </div>
      )}
    </div>
  )
}
