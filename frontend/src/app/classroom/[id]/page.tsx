'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Mic, Play, Square, Home, Brain, Send, Volume2, VolumeX, Download, Wand2, Search, ClipboardList, HelpCircle, Lightbulb, GitBranch } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { api } from '@/lib/api'
import { wsClient } from '@/lib/websocket'
import { config } from '@/lib/constants'
import { useAuthStore } from '@/store/authStore'
import { useSessionStore } from '@/store/sessionStore'
import { WhiteboardCanvas, WhiteboardCanvasRef } from '@/components/whiteboard/WhiteboardCanvas'
import { AIPanel } from '@/components/ai-panel/AIPanel'
import { VoiceIndicator } from '@/components/voice/VoiceIndicator'
import { AudioCapture } from '@/components/audio/AudioCapture'
import { CompressionNotification } from '@/components/classroom/CompressionNotification'
import { LiveTranscript } from '@/components/transcript/LiveTranscript'
import { AIPasteCard } from '@/components/classroom/AIPasteCard'
import { exportSession } from '@/lib/exportSession'
import type { Session, AIResponse } from '@/types'
import toast from 'react-hot-toast'

// Trigger auto-summarize after this many spoken words
const AUTO_SUMMARIZE_WORDS = 50
// Minimum gap between auto-summarize calls (ms)
const AUTO_SUMMARIZE_COOLDOWN = 45_000

export default function ClassroomPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const { tokens, isAuthenticated, _hasHydrated } = useAuthStore()
  const {
    currentSession,
    setCurrentSession,
    isRecording,
    setRecording,
    latestAIResponse,
    compressionStatus,
    transcriptEntries,
    addTranscriptEntry,
    updateTranscriptEntry,
    addToAIHistory,
    setAIHistory,
    setLatestAIResponse,
  } = useSessionStore()

  const whiteboardRef = useRef<WhiteboardCanvasRef>(null)
  const lastSpokenId   = useRef<string | null>(null)  // tracks last TTS'd response
  const pendingTopicRef = useRef<string | null>(null) // topic clicked from chips
  const pendingShapeRef     = useRef<string | null>(null) // shape id for "Ask AI on block"
  const pendingShapeTextRef = useRef<string | null>(null) // question text of that block
  // Stable forwarder so wsClient always calls the current handleCommandResponse
  const commandResponseRef = useRef<(data: any) => void>(() => {})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBoardShape, setSelectedBoardShape] = useState<{ id: string; text: string } | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false)
  const [auraInput, setAuraInput] = useState('')
  const [isAuraProcessing, setIsAuraProcessing] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [pasteCard, setPasteCard] = useState<{ title: string; text: string } | null>(null)
  const [isSummarizingToCanvas, setIsSummarizingToCanvas] = useState(false)
  const pendingSummarizeToCanvas = useRef(false)

  // Word buffer for auto-summarize
  const transcriptWordBuffer = useRef<string[]>([])
  const lastAutoSummarizeAt  = useRef(0)

  // Stop spinner after 120s; show a warning but don't block — response may still arrive
  useEffect(() => {
    if (!isAuraProcessing) return
    const t = setTimeout(() => {
      setIsAuraProcessing(false)
      toast.error(`${config.appName} took too long — try rephrasing or check your connection.`)
    }, 120_000)
    return () => clearTimeout(t)
  }, [isAuraProcessing])

  // TTS only for NEW responses (not restored from DB on load)
  useEffect(() => {
    if (!ttsEnabled || !latestAIResponse) return
    if (lastSpokenId.current === latestAIResponse.commandId) return
    lastSpokenId.current = latestAIResponse.commandId
    const text = extractSpeakableText(latestAIResponse)
    if (!text) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text.slice(0, 250))
    utt.rate  = 1.05
    utt.pitch = 1
    window.speechSynthesis.speak(utt)
  }, [latestAIResponse, ttsEnabled])

  useEffect(() => {
    if (!_hasHydrated) return
    if (!isAuthenticated || !tokens) {
      router.push('/auth/login')
      return
    }
    initializeSession()
    return () => { cleanup() }
  }, [_hasHydrated, isAuthenticated, sessionId])

  const initializeSession = async () => {
    try {
      const session = await api.getSession(sessionId)
      setCurrentSession(session)

      try {
        const prev = await api.getSessionTranscripts(sessionId)
        if (prev.length > 0) {
          prev.forEach((t) =>
            addTranscriptEntry({ id: `db-${t.id}`, text: t.text, timestamp: t.timestamp, isFinal: true })
          )
        }
      } catch (_) {}

      try {
        const commands = await api.getSessionCommands(sessionId)
        const completed = (commands as any[]).filter(
          (c) => c.llm_response != null && c.status === 'completed'
        )
        if (completed.length > 0) {
          const history: AIResponse[] = completed.map((c) => ({
            type: c.type || 'answer',
            data: c.llm_response ?? {},
            commandId: c.id,
            command: c.raw_command ?? '',
            processingTime: c.processing_time_ms ?? 0,
            timestamp: c.timestamp ?? new Date().toISOString(),
          }))
          setAIHistory(history)
          const latest = history[history.length - 1]
          lastSpokenId.current = latest.commandId  // don't TTS restored responses
          setLatestAIResponse(latest)
        }
      } catch (_) {}

      wsClient.onConnectCallback    = () => setIsConnected(true)
      wsClient.onDisconnectCallback = () => setIsConnected(false)
      wsClient.connect(sessionId, tokens!.accessToken)

      wsClient.on('compression_started',  () => toast('Compressing context...', { icon: '🔄' }))
      wsClient.on('compression_complete', () => toast.success('Context compressed'))
      // Use a stable forwarder so we always call the latest handleCommandResponse
      wsClient.on('command_response', (data) => commandResponseRef.current(data))
      wsClient.on('transcript_update', () => {})
      wsClient.on('error', handleError)

      setIsLoading(false)
    } catch {
      toast.error('Failed to load session')
      router.push('/dashboard')
    }
  }

  const cleanup = () => {
    if (isRecording) handleStopRecording()
    wsClient.disconnect()
    useSessionStore.getState().clearSession()
  }

  // ── AI response helpers ───────────────────────────────────────────────────

  const extractSpeakableText = (response: AIResponse): string => {
    const d = response?.data
    if (!d) return ''
    if (typeof d.answer === 'string')      return d.answer
    if (typeof d.summary === 'string')     return d.summary
    if (typeof d.content === 'string')     return d.content
    if (typeof d.explanation === 'string') return d.explanation
    if (Array.isArray(d.questions))        return `Quiz ready with ${d.questions.length} questions.`
    return ''
  }

  const extractPasteText = (response: AIResponse): string => {
    const d = response?.data
    if (!d) return ''

    // format_board: just the reformatted text
    if (response.type === 'format_board') {
      return d.formattedText || d.content || ''
    }

    // Ask AI / explain: definition + explanation + next topics
    if (typeof d.definition === 'string') {
      let text = `${d.title ? d.title + '\n\n' : ''}Definition:\n${d.definition}`
      if (d.explanation) text += `\n\nExplanation:\n${d.explanation}`
      if (Array.isArray(d.nextTopics) && d.nextTopics.length > 0) {
        text += '\n\nCover Next:\n' + d.nextTopics.map((t: string) => `• ${t}`).join('\n')
      }
      return text.trim()
    }

    // Summary
    if (typeof d.content === 'string') {
      let text = d.content
      if (Array.isArray(d.keyPoints) && d.keyPoints.length > 0) {
        text += '\n\nKey Points:\n' + d.keyPoints.map((p: string) => `• ${p}`).join('\n')
      }
      return text
    }

    if (typeof d.summary === 'string')     return d.summary
    if (typeof d.answer === 'string')      return d.answer
    if (typeof d.explanation === 'string') return d.explanation
    return ''
  }

  const getCardTitle = (type: string): string => ({
    summary:     'Summary Ready',
    answer:      `${config.appName}'s Answer`,
    explanation: 'Explanation Ready',
    example:     'Example Ready',
    diagram:     'Diagram Notes',
  }[type] ?? `${config.appName} Generated`)

  // Format AI explanation for the board — student note style, no title, no cover next
  const formatExplanationForBoard = (data: any): string => {
    if (!data) return ''
    const parts: string[] = []
    if (data.definition)  parts.push(data.definition)
    if (data.explanation) parts.push(data.explanation)
    return parts.join('\n\n').trim()
  }

  // ── Command responses ─────────────────────────────────────────────────────

  const handleCommandResponse = (data: any) => {
    const response: AIResponse = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
      command: data.command || '',
    }
    useSessionStore.getState().setLatestAIResponse(response)
    useSessionStore.getState().addToAIHistory(response)
    setIsAuraProcessing(false)

    // If this was a "Summarize to Canvas" request, auto-paste to board
    if (pendingSummarizeToCanvas.current && response.type === 'summary') {
      pendingSummarizeToCanvas.current = false
      setIsSummarizingToCanvas(false)
      const summaryText = response.data?.content || response.data?.summary || ''
      if (summaryText) {
        setTimeout(() => handlePasteToCanvas(summaryText), 300)
      }
    }

    pendingShapeRef.current     = null
    pendingShapeTextRef.current = null
    pendingTopicRef.current     = null
    setShowAIPanel(true)
  }

  // Keep commandResponseRef pointing at the latest handleCommandResponse
  commandResponseRef.current = handleCommandResponse

  const handleError = (data: any) => {
    setIsAuraProcessing(false)
    if (pendingSummarizeToCanvas.current) {
      pendingSummarizeToCanvas.current = false
      setIsSummarizingToCanvas(false)
    }
    toast.error(data.message || 'An error occurred')
  }

  // ── Auto-summarize ────────────────────────────────────────────────────────

  const triggerAutoSummarize = () => {
    if (!isConnected) return
    const now = Date.now()
    if (now - lastAutoSummarizeAt.current < AUTO_SUMMARIZE_COOLDOWN) return
    lastAutoSummarizeAt.current = now
    transcriptWordBuffer.current = []
    wsClient.sendVoiceCommand(sessionId, 'hey aura summarize what has been discussed so far', [])
    setIsAuraProcessing(true)
  }

  // ── Live transcript handler ───────────────────────────────────────────────

  const handleLiveTranscript = (text: string, isFinal: boolean) => {
    const INTERIM_ID = 'live-interim'
    const store = useSessionStore.getState()
    const hasInterim = store.transcriptEntries.some(e => e.id === INTERIM_ID)

    if (!isFinal) {
      if (hasInterim) {
        updateTranscriptEntry(INTERIM_ID, { text })
      } else {
        addTranscriptEntry({ id: INTERIM_ID, text, timestamp: new Date().toISOString(), isFinal: false })
      }
    } else {
      // Accumulate words for auto-summarize
      const words = text.split(/\s+/).filter(Boolean)
      transcriptWordBuffer.current.push(...words)
      if (transcriptWordBuffer.current.length >= AUTO_SUMMARIZE_WORDS) {
        triggerAutoSummarize()
      }

      const finalEntry = { id: `t-${Date.now()}`, text, timestamp: new Date().toISOString(), isFinal: true }
      if (hasInterim) {
        updateTranscriptEntry(INTERIM_ID, finalEntry)
        setTimeout(() => {
          addTranscriptEntry({ id: INTERIM_ID, text: 'Listening...', timestamp: new Date().toISOString(), isFinal: false })
        }, 50)
      } else {
        addTranscriptEntry(finalEntry)
      }
    }
  }

  // ── Manual command input ──────────────────────────────────────────────────

  const handleAuraSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cmd = auraInput.trim()
    if (!cmd || !isConnected) return
    const fullCommand = cmd.toLowerCase().startsWith('hey aura') ? cmd : `hey aura ${cmd}`
    await whiteboardRef.current?.captureSnapshot()
    wsClient.sendVoiceCommand(sessionId, fullCommand, [])
    setIsAuraProcessing(true)
    setAuraInput('')
  }

  // ── Board action handlers ─────────────────────────────────────────────────

  const handleAskAI = async () => {
    if (!isConnected || isAuraProcessing) return
    try {
      const selected = whiteboardRef.current?.getSelectedShape() ?? selectedBoardShape
      pendingTopicRef.current = null

      if (selected?.text) {
        // Ask AI about the selected block → merges Q+A into one block
        pendingShapeRef.current = selected.id
        pendingShapeTextRef.current = selected.text
        setIsAuraProcessing(true)
        const imageData = await whiteboardRef.current?.captureSnapshot()
        wsClient.sendVoiceCommand(
          sessionId,
          `hey aura explain ${selected.text} with a clear definition and a detailed explanation`,
          [],
          imageData
        )
      } else {
        // No block selected — explain the board generally, show paste card
        pendingShapeRef.current = null
        setIsAuraProcessing(true)
        toast('Asking AI about the board...')
        const imageData = await whiteboardRef.current?.captureSnapshot()
        wsClient.sendVoiceCommand(
          sessionId,
          'hey aura explain the topic on the whiteboard with a clear definition and a detailed explanation',
          [],
          imageData
        )
        setShowAIPanel(true)
      }
    } catch (err) {
      setIsAuraProcessing(false)
      pendingShapeRef.current = null
      toast.error('Could not read the board. Try again.')
    }
  }

  const handleDiagramBoard = (mode: 'add' | 'replace', dataUrl: string) => {
    whiteboardRef.current?.addImageToBoard(dataUrl, mode)
    toast.success(mode === 'replace' ? 'Board replaced with diagram' : 'Diagram added to board')
  }

  const handleSummarizeToCanvas = async () => {
    if (!isConnected || isAuraProcessing) return
    pendingSummarizeToCanvas.current = true
    setIsSummarizingToCanvas(true)
    setIsAuraProcessing(true)
    const imageData = await whiteboardRef.current?.captureSnapshot()
    wsClient.sendVoiceCommand(sessionId, 'hey aura summarize what has been discussed so far', [], imageData)
  }

  const handlePasteToCanvas = (text: string) => {
    whiteboardRef.current?.addBlock(text)
    toast.success('Added to canvas ↑', { duration: 1500 })
  }

  const handleGenerateDiagram = async (topic: string) => {
    if (!isConnected || isAuraProcessing) return
    setIsAuraProcessing(true)
    const imageData = await whiteboardRef.current?.captureSnapshot()
    wsClient.sendVoiceCommand(
      sessionId,
      `hey aura generate a diagram for ${topic}`,
      [],
      imageData,
    )
  }

  const handleCleanBoard = async () => {
    try {
      setIsAuraProcessing(true)
      toast('Reading handwriting...')
      const imageData = await whiteboardRef.current?.exportCanvas()
      if (!imageData) {
        setIsAuraProcessing(false)
        toast.error('Could not capture board')
        return
      }
      const { blocks } = await api.cleanBoard(sessionId, imageData)
      if (blocks.length > 0) {
        whiteboardRef.current?.replaceWithBlocks(blocks)
        toast.success(`Converted ${blocks.length} item${blocks.length !== 1 ? 's' : ''} to blocks`)
      } else {
        toast('No handwriting found on the board', { icon: '✏️' })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not read the board')
    } finally {
      setIsAuraProcessing(false)
    }
  }

  // Clicking a "Cover Next" chip explains that topic + queues it for board paste
  const handleTopicClick = async (topic: string) => {
    if (!isConnected || isAuraProcessing) return
    try {
      pendingTopicRef.current = topic
      setIsAuraProcessing(true)
      const imageData = await whiteboardRef.current?.captureSnapshot()
      wsClient.sendVoiceCommand(
        sessionId,
        `hey aura explain ${topic} with a clear definition and a detailed explanation`,
        [],
        imageData
      )
      setShowAIPanel(true)
    } catch (err) {
      setIsAuraProcessing(false)
      pendingTopicRef.current = null
    }
  }

  // ── Paste to board ────────────────────────────────────────────────────────

  const handlePasteToBoard = () => {
    if (!pasteCard) return
    whiteboardRef.current?.addTextToBoard(pasteCard.text)
    setPasteCard(null)
    toast.success('Added to whiteboard')
  }

  // ── Session controls ──────────────────────────────────────────────────────

  const handleStartRecording = () => {
    setRecording(true)
    setAudioEnabled(true)
    transcriptWordBuffer.current = []
    toast.success('Recording started — Aura is listening')
  }

  const handleStopRecording = () => {
    setRecording(false)
    setAudioEnabled(false)
    toast('Recording paused', { icon: '⏸' })
  }

  const handleDownload = () => {
    const store = useSessionStore.getState()
    exportSession({
      subject:     currentSession?.subject ?? 'Session',
      date:        currentSession?.startTime ?? new Date().toISOString(),
      transcripts: store.transcriptEntries,
      aiHistory:   store.aiHistory,
    })
  }

  const handleConfirmEndSession = async () => {
    try {
      await api.endSession(sessionId)
      toast.success('Session ended')
      router.push('/dashboard')
    } catch {
      toast.error('Failed to end session')
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-dark-50">Preparing classroom...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-dark-900">
      {/* Header */}
      <header className="h-12 border-b border-dark-700 bg-dark-800 flex items-center justify-between px-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
            <Home className="w-4 h-4 mr-1.5" />
            <span className="text-dark-50">Dashboard</span>
          </Button>
          <div className="h-5 w-px bg-dark-700" />
          <div className="flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-primary-500" />
            <span className="font-medium text-dark-50 text-sm">{currentSession?.subject}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRecording && <VoiceIndicator isActive={audioEnabled} />}
          <div className="h-5 w-px bg-dark-600" />

          {/* Ask AI — explains selected block or whole board */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAskAI}
            disabled={isAuraProcessing || !isConnected}
            title={selectedBoardShape ? `Explain: ${selectedBoardShape.text}` : 'Explain what\'s on the board'}
          >
            <Search className="w-3.5 h-3.5 text-green-400 mr-1" />
            <span className="text-xs text-green-300 max-w-[120px] truncate">
              {selectedBoardShape ? `Ask: ${selectedBoardShape.text}` : 'Ask AI'}
            </span>
          </Button>

          {/* Clean Board — reformats board text into structured format */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCleanBoard}
            disabled={isAuraProcessing || !isConnected}
            title="Reformat and clean up the whiteboard text"
          >
            <Wand2 className="w-3.5 h-3.5 text-indigo-400 mr-1" />
            <span className="text-xs text-indigo-300">Clean Board</span>
          </Button>

          <div className="h-5 w-px bg-dark-600" />

          {/* TTS toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTtsEnabled(!ttsEnabled)}
            title={ttsEnabled ? 'Mute voice responses' : 'Unmute voice responses'}
          >
            {ttsEnabled
              ? <Volume2 className="w-3.5 h-3.5 text-primary-400" />
              : <VolumeX className="w-3.5 h-3.5 text-dark-400" />
            }
          </Button>

          {/* Download */}
          <Button variant="ghost" size="sm" onClick={handleDownload} title="Download session notes">
            <Download className="w-3.5 h-3.5 text-dark-400" />
          </Button>

          <div className="h-5 w-px bg-dark-600" />

          {!isRecording ? (
            <Button variant="primary" size="sm" onClick={handleStartRecording}>
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Start
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={handleStopRecording}>
              <Square className="w-3.5 h-3.5 mr-1.5" />
              Pause
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowEndSessionConfirm(true)}>
            End Session
          </Button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <WhiteboardCanvas
            ref={whiteboardRef}
            sessionId={sessionId}
            isRecording={isRecording}
            onShapeSelected={(id, text) =>
              setSelectedBoardShape(id && text ? { id, text } : null)
            }
          />

          {/* Floating "Ask AI" bar — appears when a block is selected */}
          {selectedBoardShape && !isAuraProcessing && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-dark-800/95 backdrop-blur border border-indigo-500/40 rounded-2xl px-4 py-2.5 shadow-xl">
              <Search className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-xs text-indigo-300 shrink-0">Ask AI about:</span>
              <span className="text-xs font-semibold text-white max-w-[180px] truncate">{selectedBoardShape.text}</span>
              <button
                onClick={handleAskAI}
                disabled={!isConnected}
                className="ml-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-medium px-3 py-1 rounded-xl transition-colors"
              >
                Explain →
              </button>
              <button
                onClick={() => setSelectedBoardShape(null)}
                className="text-dark-500 hover:text-dark-300 text-xs ml-1 transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          {/* AI paste card removed — paste button is now in the AI panel */}
        </div>

        {showAIPanel && (
          <AIPanel
            onClose={() => setShowAIPanel(false)}
            onTopicClick={handleTopicClick}
            onDiagramBoard={handleDiagramBoard}
            onPasteToCanvas={handlePasteToCanvas}
            onGenerateDiagram={handleGenerateDiagram}
          />
        )}
      </div>

      {/* Quick Action Strip — visible while recording */}
      {isRecording && (
        <div className="border-t border-dark-700 bg-dark-800/80 flex items-center gap-2 px-3 py-1.5">
          <span className="text-[10px] text-dark-500 uppercase tracking-widest shrink-0">Quick Actions</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { label: 'Summarize', icon: ClipboardList, cmd: 'hey aura summarize what has been discussed so far' },
              { label: 'Quiz', icon: HelpCircle, cmd: 'hey aura generate a quiz about what has been discussed' },
              { label: 'Explain Board', icon: Lightbulb, cmd: 'hey aura explain the topic on the whiteboard with a clear definition and a detailed explanation' },
              { label: 'Diagram', icon: GitBranch, cmd: 'hey aura generate a diagram for the current topic on the whiteboard' },
            ].map(({ label, icon: Icon, cmd }) => (
              <button
                key={label}
                disabled={isAuraProcessing || !isConnected}
                onClick={async () => {
                  if (isAuraProcessing || !isConnected) return
                  setIsAuraProcessing(true)
                  const imageData = await whiteboardRef.current?.captureSnapshot()
                  wsClient.sendVoiceCommand(sessionId, cmd, [], imageData)
                  setShowAIPanel(true)
                }}
                className="flex items-center gap-1 text-[11px] text-dark-300 hover:text-dark-50 bg-dark-700 hover:bg-dark-600 border border-dark-600 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="h-12 border-t border-dark-700 bg-dark-800 flex items-center justify-between px-3 gap-3">
        <div className="flex items-center gap-1.5 text-xs text-dark-200 shrink-0">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>

        {/* Manual command input */}
        <form onSubmit={handleAuraSubmit} className="flex-1 flex items-center gap-2 max-w-lg">
          <div className="flex-1 relative">
            <input
              type="text"
              value={auraInput}
              onChange={(e) => setAuraInput(e.target.value)}
              placeholder={
                isAuraProcessing
                  ? `${config.appName} is thinking…`
                  : `Ask ${config.appName} — e.g. "generate a quiz" or "explain this"`
              }
              disabled={isAuraProcessing || !isConnected}
              className="w-full h-7 bg-dark-700 border border-dark-600 rounded-md px-3 text-xs text-dark-50 placeholder-dark-400 focus:outline-none focus:border-primary-500 disabled:opacity-50"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!auraInput.trim() || isAuraProcessing || !isConnected}
            className="h-7 px-2.5"
          >
            {isAuraProcessing ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </form>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={showAIPanel ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setShowAIPanel(!showAIPanel)}
            title={showAIPanel ? `Close ${config.appName} panel` : `Open ${config.appName} & History`}
          >
            <Brain className="w-3.5 h-3.5 mr-1.5" />
            {config.appName}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTranscript(!showTranscript)}
          >
            <Mic className="w-3.5 h-3.5 mr-1.5" />
            Transcript
            {isRecording && (
              <span className="relative flex h-2 w-2 ml-2 self-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
              </span>
            )}
          </Button>
        </div>
      </footer>

      {/* Audio capture — no trigger word, pure transcription */}
      {isRecording && audioEnabled && (
        <AudioCapture
          sessionId={sessionId}
          onError={(error) => toast.error(error)}
          onLiveTranscript={handleLiveTranscript}
        />
      )}

      {compressionStatus && <CompressionNotification status={compressionStatus} />}

      <LiveTranscript
        entries={transcriptEntries}
        isRecording={isRecording}
        isOpen={showTranscript}
        onToggle={() => setShowTranscript(!showTranscript)}
        onSummarizeToCanvas={isRecording ? handleSummarizeToCanvas : undefined}
        isSummarizing={isSummarizingToCanvas}
      />

      <ConfirmModal
        open={showEndSessionConfirm}
        onClose={() => setShowEndSessionConfirm(false)}
        title="End session"
        message="Are you sure you want to end this session?"
        confirmLabel="End Session"
        cancelLabel="Cancel"
        onConfirm={handleConfirmEndSession}
      />
    </div>
  )
}
