'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import type { CompressionNotification as CompressionNotificationType } from '@/types'

interface CompressionNotificationProps {
  status: CompressionNotificationType
}

export function CompressionNotification({ status }: CompressionNotificationProps) {
  const getIcon = () => {
    switch (status.status) {
      case 'started':
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-400" />
    }
  }

  const getColor = () => {
    switch (status.status) {
      case 'started':
        return 'bg-blue-500/10 border-blue-500/20'
      case 'complete':
        return 'bg-green-500/10 border-green-500/20'
      case 'failed':
        return 'bg-red-500/10 border-red-500/20'
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
      >
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${getColor()} backdrop-blur-lg`}>
          {getIcon()}
          <div>
            <p className="text-sm font-medium text-white">{status.message}</p>
            {status.method && (
              <p className="text-xs text-dark-400 mt-0.5">
                Method: {status.method === 'llm' ? 'AI Compression' : 'Simple Compression'}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
