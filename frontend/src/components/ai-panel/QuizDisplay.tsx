'use client'

import { useState } from 'react'
import { CheckCircle, Circle } from 'lucide-react'
import type { QuizData } from '@/types'

interface QuizDisplayProps {
  data: QuizData
}

export function QuizDisplay({ data }: QuizDisplayProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})

  const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: optionIndex,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-dark-50 mb-2">{data.title || 'Quiz'}</h3>
        <p className="text-sm text-dark-200">
          {data.questions.length} questions
          {data.timeLimit && ` • ${data.timeLimit} minutes`}
        </p>
      </div>

      <div className="space-y-6">
        {data.questions.map((question, qIndex) => (
          <div key={qIndex} className="card p-4">
            <div className="mb-3">
              <span className="text-sm font-medium text-primary-500">Question {qIndex + 1}</span>
              <p className="text-dark-50 mt-1">{question.question}</p>
            </div>

            <div className="space-y-2">
              {question.options.map((option, oIndex) => {
                const isSelected = selectedAnswers[qIndex] === oIndex
                const isCorrect = oIndex === question.correctAnswer
                
                return (
                  <button
                    key={oIndex}
                    onClick={() => handleSelectAnswer(qIndex, oIndex)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-dark-800'
                        : 'border-dark-700 hover:border-dark-600 bg-dark-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isSelected ? (
                        <CheckCircle className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-dark-300 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={isSelected ? 'text-dark-50' : 'text-dark-200'}>
                        {option}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {question.explanation && (
              <div className="mt-3 p-3 bg-dark-800 rounded-lg border border-dark-700">
                <p className="text-sm text-dark-200">
                  <span className="font-medium text-primary-500">Explanation: </span>
                  {question.explanation}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
