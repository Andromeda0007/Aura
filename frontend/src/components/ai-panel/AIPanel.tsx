'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Share2, RefreshCw, CheckCircle } from 'lucide-react'
import { Button } from '../shared/Button'
import { QuizDisplay } from './QuizDisplay'
import { SummaryDisplay } from './SummaryDisplay'
import { ExplanationDisplay } from './ExplanationDisplay'
import type { AIResponse } from '@/types'

interface AIPanelProps {
  response: AIResponse
  onClose: () => void
}

export function AIPanel({ response, onClose }: AIPanelProps) {
  const renderContent = () => {
    switch (response.type) {
      case 'quiz':
        return <QuizDisplay data={response.data} />
      case 'summary':
        return <SummaryDisplay data={response.data} />
      case 'explanation':
      case 'example':
      case 'answer':
        return <ExplanationDisplay data={response.data} type={response.type} />
      default:
        return <div className="text-dark-200">Response type not supported</div>
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-[400px] border-l border-dark-700 bg-dark-800 flex flex-col"
      >
        <div className="h-14 border-b border-dark-700 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
            <span className="font-medium text-dark-50">Aura Response</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5 text-dark-200" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>

        <div className="h-16 border-t border-dark-700 px-4 flex items-center justify-between">
          <span className="text-xs text-dark-200">
            Processed in {response.processingTime}ms
          </span>
          <div className="flex items-center gap-2">
            {response.type === 'quiz' && (
              <>
                <Button variant="ghost" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
                <Button variant="primary" size="sm">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
