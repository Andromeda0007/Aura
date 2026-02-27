'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Brain, BookOpen, Lightbulb, MessageCircle,
  FileQuestion, ClipboardList, Network, History, Zap, ChevronRight,
} from 'lucide-react'
import { QuizDisplay } from './QuizDisplay'
import { SummaryDisplay } from './SummaryDisplay'
import { ExplanationDisplay } from './ExplanationDisplay'
import { DiagramDisplay } from './DiagramDisplay'
import { useSessionStore } from '@/store/sessionStore'
import type { AIResponse } from '@/types'

interface AIPanelProps {
  onClose: () => void
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  quiz:        { label: 'Quiz',        icon: <FileQuestion className="w-3.5 h-3.5" />,  color: 'text-violet-400', bg: 'bg-violet-500/15 border-violet-500/30' },
  summary:     { label: 'Summary',     icon: <ClipboardList className="w-3.5 h-3.5" />, color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30'   },
  explanation: { label: 'Explanation', icon: <BookOpen className="w-3.5 h-3.5" />,      color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/30' },
  example:     { label: 'Problem',     icon: <Lightbulb className="w-3.5 h-3.5" />,     color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/30' },
  answer:      { label: 'Answer',      icon: <MessageCircle className="w-3.5 h-3.5" />, color: 'text-sky-400',    bg: 'bg-sky-500/15 border-sky-500/30'     },
  diagram:     { label: 'Diagram',     icon: <Network className="w-3.5 h-3.5" />,       color: 'text-indigo-400', bg: 'bg-indigo-500/15 border-indigo-500/30'},
}

function getTitle(r: AIResponse): string {
  return r.data?.title ?? r.data?.subject ?? TYPE_META[r.type]?.label ?? 'Response'
}

function timeAgo(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function renderContent(r: AIResponse) {
  switch (r.type) {
    case 'quiz':        return <QuizDisplay data={r.data} />
    case 'summary':     return <SummaryDisplay data={r.data} />
    case 'explanation':
    case 'example':
    case 'answer':      return <ExplanationDisplay data={r.data} type={r.type} />
    case 'diagram':     return <DiagramDisplay data={r.data} />
    default:            return <p className="text-dark-300 text-sm">Response type not supported.</p>
  }
}

type Tab = 'response' | 'history'

export function AIPanel({ onClose }: AIPanelProps) {
  const { latestAIResponse, aiHistory } = useSessionStore()
  const [tab, setTab] = useState<Tab>('response')
  const [viewingResponse, setViewingResponse] = useState<AIResponse | null>(null)

  // Auto-switch to latest response when a new one arrives
  useEffect(() => {
    if (latestAIResponse) {
      setViewingResponse(latestAIResponse)
      setTab('response')
    }
  }, [latestAIResponse])

  const active = viewingResponse ?? latestAIResponse
  const isShowingLatest = active?.commandId === latestAIResponse?.commandId
  const historyList = [...aiHistory].reverse()

  const handleViewHistoryItem = (item: AIResponse) => {
    setViewingResponse(item)
    setTab('response')
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="w-[420px] border-l border-dark-700 bg-dark-800 flex flex-col"
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="h-12 border-b border-dark-700 flex items-center justify-between px-3 shrink-0 gap-3">
          {/* Logo */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
            <span className="font-semibold text-sm text-dark-50">Aura</span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-dark-900/60 rounded-lg p-0.5 flex-1 max-w-[220px]">
            <button
              onClick={() => setTab('response')}
              className={`flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium transition-all ${
                tab === 'response'
                  ? 'bg-dark-700 text-dark-50 shadow-sm'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              <Zap className="w-3 h-3" />
              Response
            </button>
            <button
              onClick={() => setTab('history')}
              className={`flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium transition-all ${
                tab === 'history'
                  ? 'bg-dark-700 text-dark-50 shadow-sm'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              <History className="w-3 h-3" />
              History
              {aiHistory.length > 0 && (
                <span className={`text-[10px] px-1 py-0.5 rounded-full min-w-[16px] text-center leading-none ${
                  tab === 'history' ? 'bg-primary-500 text-white' : 'bg-dark-700 text-dark-400'
                }`}>
                  {aiHistory.length}
                </span>
              )}
            </button>
          </div>

          {/* Close */}
          <button onClick={onClose} className="p-1 rounded-md text-dark-400 hover:text-dark-50 hover:bg-dark-700 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tab content ─────────────────────────────────────────── */}
        <AnimatePresence mode="wait">

          {/* ── RESPONSE TAB ── */}
          {tab === 'response' && (
            <motion.div
              key="response-tab"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Response meta bar */}
              {active && (
                <div className="flex items-center gap-2 px-4 py-2 border-b border-dark-700 bg-dark-900/40 shrink-0">
                  <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${TYPE_META[active.type]?.bg}`}>
                    <span className={TYPE_META[active.type]?.color}>{TYPE_META[active.type]?.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-dark-100 truncate">{getTitle(active)}</p>
                    <p className="text-[10px] text-dark-400 truncate">{active.command || TYPE_META[active.type]?.label}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isShowingLatest && latestAIResponse && (
                      <button
                        onClick={() => { setViewingResponse(latestAIResponse); setTab('response') }}
                        className="text-[10px] text-primary-400 hover:text-primary-300 transition-colors whitespace-nowrap"
                      >
                        ← Latest
                      </button>
                    )}
                    <span className="text-[10px] text-dark-500">{active.processingTime}ms</span>
                  </div>
                </div>
              )}

              {/* Response content */}
              <div className="flex-1 overflow-y-auto p-5">
                <AnimatePresence mode="wait">
                  {active ? (
                    <motion.div
                      key={active.commandId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16 }}
                    >
                      {renderContent(active)}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-full gap-4 text-center py-20"
                    >
                      <Brain className="w-10 h-10 text-dark-600" />
                      <div>
                        <p className="text-dark-400 text-sm font-medium">No response yet</p>
                        <p className="text-dark-500 text-xs mt-1">
                          Try <span className="text-primary-400">"generate a quiz"</span> or{' '}
                          <span className="text-primary-400">"diagram of benzene"</span>
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <motion.div
              key="history-tab"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {historyList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
                  <History className="w-10 h-10 text-dark-600" />
                  <div>
                    <p className="text-dark-400 text-sm font-medium">No history yet</p>
                    <p className="text-dark-500 text-xs mt-1">Responses you ask Aura will appear here</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-[10px] font-semibold text-dark-500 uppercase tracking-widest">
                      {aiHistory.length} response{aiHistory.length !== 1 ? 's' : ''} this session
                    </p>
                  </div>
                  <div className="flex flex-col">
                    {historyList.map((item, idx) => {
                      const meta = TYPE_META[item.type]
                      const isLatest = item.commandId === latestAIResponse?.commandId
                      return (
                        <button
                          key={item.commandId ?? idx}
                          onClick={() => handleViewHistoryItem(item)}
                          className="flex items-center gap-3 px-4 py-3 text-left hover:bg-dark-700/50 transition-colors border-b border-dark-700/60 last:border-0 group"
                        >
                          {/* Type icon */}
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${meta?.bg ?? 'bg-dark-700 border-dark-600'}`}>
                            <span className={meta?.color ?? 'text-dark-400'}>{meta?.icon}</span>
                          </div>

                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-dark-100 truncate">{getTitle(item)}</p>
                              {isLatest && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded-full shrink-0 font-medium">
                                  latest
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-dark-400 truncate mt-0.5">
                              {item.command || meta?.label}
                            </p>
                          </div>

                          {/* Right side */}
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] text-dark-500">{timeAgo(item.timestamp)}</span>
                            <ChevronRight className="w-3 h-3 text-dark-600 group-hover:text-dark-400 transition-colors" />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
