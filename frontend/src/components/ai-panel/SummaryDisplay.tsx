'use client'

import { FileText, ChevronRight } from 'lucide-react'

interface SummaryDisplayProps {
  data: {
    title?: string
    content: string
    keyPoints?: string[]
    topics?: string[]
  }
}

export function SummaryDisplay({ data }: SummaryDisplayProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-dark-800 border-2 border-primary-500/50 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-primary-500" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-dark-50 mb-2">
            {data.title || 'Summary'}
          </h3>
          <p className="text-dark-200 leading-relaxed whitespace-pre-wrap">{data.content}</p>
        </div>
      </div>

      {data.keyPoints && data.keyPoints.length > 0 && (
        <div className="card p-4">
          <h4 className="font-medium text-dark-50 mb-3">Key Points</h4>
          <ul className="space-y-2">
            {data.keyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-2 text-dark-200">
                <ChevronRight className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.topics && data.topics.length > 0 && (
        <div>
          <h4 className="font-medium text-dark-50 mb-3">Topics Covered</h4>
          <div className="flex flex-wrap gap-2">
            {data.topics.map((topic, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-dark-800 text-dark-200 rounded-full text-sm border border-dark-700"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
