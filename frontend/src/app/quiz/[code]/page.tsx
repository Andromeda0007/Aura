'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Brain, CheckCircle, XCircle, Trophy } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { api } from '@/lib/api'
import type { Quiz, QuizQuestion } from '@/types'
import toast from 'react-hot-toast'

export default function QuizPage() {
  const params = useParams()
  const shareCode = params.code as string

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; total: number; percentage: number } | null>(null)
  const [studentName, setStudentName] = useState('')

  useEffect(() => {
    fetchQuiz()
  }, [shareCode])

  const fetchQuiz = async () => {
    try {
      const quizData = await api.getQuiz(shareCode)
      setQuiz(quizData)
      setSelectedAnswers(new Array(quizData.quizData.questions.length).fill(-1))
    } catch (error: any) {
      toast.error(error.message || 'Quiz not found')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectAnswer = (questionIndex: number, answerIndex: number) => {
    const newAnswers = [...selectedAnswers]
    newAnswers[questionIndex] = answerIndex
    setSelectedAnswers(newAnswers)
  }

  const handleSubmit = async () => {
    if (selectedAnswers.some((answer) => answer === -1)) {
      toast.error('Please answer all questions')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await api.submitQuizAttempt(shareCode, selectedAnswers, studentName || undefined)
      setResult({
        score: response.score,
        total: response.totalQuestions,
        percentage: response.percentage,
      })
      toast.success('Quiz submitted!')
    } catch (error: any) {
      toast.error('Failed to submit quiz')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-dark-200">Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <XCircle className="w-16 h-16 text-primary-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-dark-50 mb-2">Quiz Not Found</h1>
          <p className="text-dark-200">This quiz may have expired or the code is incorrect.</p>
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="card p-8 text-center">
            <div className="w-20 h-20 bg-dark-800 border-2 border-primary-500/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-10 h-10 text-primary-500" />
            </div>
            
            <h1 className="text-3xl font-bold text-dark-50 mb-2">
              Quiz Completed!
            </h1>
            
            <div className="my-8">
              <div className="text-6xl font-bold text-primary-500 mb-2">
                {result.percentage.toFixed(0)}%
              </div>
              <p className="text-dark-200">
                You scored {result.score} out of {result.total}
              </p>
            </div>

            <div className="space-y-2">
              {result.percentage >= 80 && (
                <p className="text-primary-500 font-medium">Excellent work!</p>
              )}
              {result.percentage >= 60 && result.percentage < 80 && (
                <p className="text-primary-500 font-medium">Good job!</p>
              )}
              {result.percentage < 60 && (
                <p className="text-primary-500 font-medium">Keep practicing!</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center border-2 border-primary-500/50">
              <Brain className="w-6 h-6 text-primary-500" />
            </div>
            <span className="text-2xl font-bold text-dark-50">Aura Quiz</span>
          </div>

          <div className="card p-8 mb-6">
            <h1 className="text-3xl font-bold text-dark-50 mb-4">
              {quiz.quizData.title || 'Classroom Quiz'}
            </h1>
            
            <div className="flex items-center gap-4 text-sm text-dark-200 mb-6">
              <span>{quiz.quizData.questions.length} questions</span>
              {quiz.quizData.timeLimit && <span>{quiz.quizData.timeLimit} minutes</span>}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Your Name (Optional)
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="input"
                placeholder="Enter your name"
              />
            </div>
          </div>

          <div className="space-y-6 mb-8">
            {quiz.quizData.questions.map((question, qIndex) => (
              <motion.div
                key={qIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qIndex * 0.1 }}
              >
                <div className="card p-6">
                  <div className="mb-4">
                    <span className="text-sm font-medium text-primary-500">Question {qIndex + 1}</span>
                    <p className="text-lg font-medium text-dark-50 mt-1">{question.question}</p>
                  </div>

                  <div className="space-y-3">
                    {question.options.map((option, oIndex) => {
                      const isSelected = selectedAnswers[qIndex] === oIndex

                      return (
                        <button
                          key={oIndex}
                          onClick={() => handleSelectAnswer(qIndex, oIndex)}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-primary-500 bg-dark-800'
                              : 'border-dark-700 hover:border-dark-600 bg-dark-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected
                                  ? 'border-primary-500 bg-primary-500'
                                  : 'border-dark-300'
                              }`}
                            >
                              {isSelected && <CheckCircle className="w-4 h-4 text-dark-900" />}
                            </div>
                            <span className={isSelected ? 'text-dark-50 font-medium' : 'text-dark-200'}>
                              {option}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="card p-6">
            <Button
              variant="primary"
              size="lg"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              className="w-full"
            >
              Submit Quiz
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
