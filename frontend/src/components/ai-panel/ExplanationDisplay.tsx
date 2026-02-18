'use client'

import { Lightbulb, BookOpen, MessageCircle } from 'lucide-react'

interface ExplanationDisplayProps {
  data: {
    content: string
    title?: string
  }
  type: 'explanation' | 'example' | 'answer'
}

export function ExplanationDisplay({ data, type }: ExplanationDisplayProps) {
  const getIcon = () => {
    switch (type) {
      case 'explanation':
        return <BookOpen className="w-5 h-5 text-primary-500" />
      case 'example':
        return <Lightbulb className="w-5 h-5 text-primary-500" />
      case 'answer':
        return <MessageCircle className="w-5 h-5 text-primary-500" />
    }
  }

  const getTitle = () => {
    if (data.title) return data.title
    
    switch (type) {
      case 'explanation':
        return 'Explanation'
      case 'example':
        return 'Example'
      case 'answer':
        return 'Answer'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-dark-800 border-2 border-primary-500/50 rounded-lg flex items-center justify-center flex-shrink-0">
          {getIcon()}
        </div>
        <div>
          <h3 className="text-xl font-bold text-dark-50 mb-2">{getTitle()}</h3>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-dark-200 leading-relaxed whitespace-pre-wrap">{data.content}</p>
      </div>
    </div>
  )
}
