'use client'

import { Mic } from 'lucide-react'

interface VoiceIndicatorProps {
  isActive: boolean
}

export function VoiceIndicator({ isActive }: VoiceIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-700 border border-dark-600">
      <Mic className={`w-4 h-4 ${isActive ? 'text-red-400' : 'text-dark-400'}`} />
      
      {isActive && (
        <div className="flex items-center gap-1">
          <div className="w-1 h-3 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-1 h-4 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="w-1 h-3 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      )}
      
      <span className={`text-sm font-medium ${isActive ? 'text-red-400' : 'text-dark-400'}`}>
        {isActive ? 'Recording' : 'Paused'}
      </span>
    </div>
  )
}
