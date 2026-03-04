'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Mic, MicOff, Play, Square, Home, Brain, Send } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { api } from '@/lib/api'
import { wsClient } from '@/lib/websocket'
import { config } from '@/lib/constants'
import { useAuthStore } from '@/store/authStore'
import { useSessionStore } from '@/store/sessionStore'
import { WhiteboardCanvas } from '@/components/whiteboard/WhiteboardCanvas'
import { AIPanel } from '@/components/ai-panel/AIPanel'
import { VoiceIndicator } from '@/components/voice/VoiceIndicator'
import { AudioCapture } from '@/components/audio/AudioCapture'
import { CompressionNotification } from '@/components/classroom/CompressionNotification'
import { LiveTranscript } from '@/components/transcript/LiveTranscript'
import type { Session, AIResponse } from '@/types'
import toast from 'react-hot-toast'

export default function ClassroomPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string
  
  const { user, tokens, isAuthenticated, _hasHydrated } = useAuthStore()
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

  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false)
  const [auraInput, setAuraInput] = useState('')
  const [isAuraProcessing, setIsAuraProcessing] = useState(false)

  // Backoff: stop spinner if no response within 90s (e.g. backend error or invalid command)
  useEffect(() => {
    if (!isAuraProcessing) return
    const t = setTimeout(() => {
      setIsAuraProcessing(false)
      toast.error(`${config.appName} took too long — try rephrasing or check your connection.`)
    }, 90000)
    return () => clearTimeout(t)
  }, [isAuraProcessing])

  useEffect(() => {
    if (!_hasHydrated) return   // wait for localStorage to rehydrate
    if (!isAuthenticated || !tokens) {
      router.push('/auth/login')
      return
    }
    initializeSession()
    return () => {
      cleanup()
    }
  }, [_hasHydrated, isAuthenticated, sessionId])

  const initializeSession = async () => {
    try {
      const session = await api.getSession(sessionId)
      setCurrentSession(session)

      // Restore previous transcripts from DB
      try {
        const prev = await api.getSessionTranscripts(sessionId)
        if (prev.length > 0) {
          prev.forEach((t) =>
            addTranscriptEntry({ id: `db-${t.id}`, text: t.text, timestamp: t.timestamp, isFinal: true })
          )
        }
      } catch (_) {
        // non-fatal — just skip if it fails
      }

      // Restore persisted AI history for this session
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
          setLatestAIResponse(history[history.length - 1])
        }
      } catch (_) {
        // non-fatal — just skip if it fails
      }

      wsClient.connect(sessionId, tokens!.accessToken)
      setIsConnected(true)

      wsClient.on('compression_started', handleCompressionStarted)
      wsClient.on('compression_complete', handleCompressionComplete)
      wsClient.on('command_response', handleCommandResponse)
      wsClient.on('transcript_update', handleTranscriptUpdate)
      wsClient.on('error', handleError)

      setIsLoading(false)
    } catch (error: any) {
      toast.error('Failed to load session')
      router.push('/dashboard')
    }
  }

  const cleanup = () => {
    if (isRecording) {
      handleStopRecording()
    }
    wsClient.disconnect()
    useSessionStore.getState().clearSession()
  }

  const handleCompressionStarted = (data: any) => {
    toast('Compressing context...', { icon: '🔄' })
  }

  const handleCompressionComplete = (data: any) => {
    toast.success('Context compressed successfully')
  }

  const handleCommandResponse = (data: any) => {
    const response = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
      command: data.command || '',
    }
    useSessionStore.getState().setLatestAIResponse(response)
    useSessionStore.getState().addToAIHistory(response)
    setIsAuraProcessing(false)
    setShowAIPanel(true)
  }

  const handleAuraSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cmd = auraInput.trim()
    if (!cmd || !isConnected) return
    const fullCommand = cmd.toLowerCase().startsWith('hey aura') ? cmd : `hey aura ${cmd}`
    wsClient.sendVoiceCommand(sessionId, fullCommand)
    setIsAuraProcessing(true)
    setAuraInput('')
  }

  const handleError = (data: any) => {
    setIsAuraProcessing(false)
    toast.error(data.message || 'An error occurred')
  }

  const handleTranscriptUpdate = (data: any) => {
    // Called by backend when it confirms text was saved — optional extra confirmation
    // (frontend already shows the text from Web Speech API directly)
  }

  const handleLiveTranscript = (text: string, isFinal: boolean) => {
    const INTERIM_ID = 'live-interim'
    const store = useSessionStore.getState()
    const hasInterim = store.transcriptEntries.some(e => e.id === INTERIM_ID)

    if (!isFinal) {
      // Live interim — update the single "typing" slot
      if (hasInterim) {
        updateTranscriptEntry(INTERIM_ID, { text })
      } else {
        addTranscriptEntry({ id: INTERIM_ID, text, timestamp: new Date().toISOString(), isFinal: false })
      }
    } else {
      // Confirmed sentence — add as a real entry, reset interim to "Listening…"
      const finalEntry = { id: `t-${Date.now()}`, text, timestamp: new Date().toISOString(), isFinal: true }
      if (hasInterim) {
        updateTranscriptEntry(INTERIM_ID, finalEntry)
        setTimeout(() => {
          addTranscriptEntry({ id: INTERIM_ID, text: '🎙 Listening…', timestamp: new Date().toISOString(), isFinal: false })
        }, 50)
      } else {
        addTranscriptEntry(finalEntry)
      }
    }
  }

  const handleStartRecording = () => {
    setRecording(true)
    setAudioEnabled(true)
    toast.success('Session started')
  }

  const handleStopRecording = () => {
    setRecording(false)
    setAudioEnabled(false)
    toast('Session paused', { icon: '⏸️' })
  }

  const handleEndSessionClick = () => {
    setShowEndSessionConfirm(true)
  }

  const handleConfirmEndSession = async () => {
    try {
      await api.endSession(sessionId)
      toast.success('Session ended')
      router.push('/dashboard')
    } catch (error: any) {
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
          <Button variant="outline" size="sm" onClick={handleEndSessionClick}>
            End Session
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <WhiteboardCanvas sessionId={sessionId} isRecording={isRecording} />
        </div>

        {showAIPanel && (
          <AIPanel onClose={() => setShowAIPanel(false)} />
        )}
      </div>

      <footer className="h-12 border-t border-dark-700 bg-dark-800 flex items-center justify-between px-3 gap-3">
        <div className="flex items-center gap-1.5 text-xs text-dark-200 shrink-0">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>

        {/* Aura command input */}
        <form onSubmit={handleAuraSubmit} className="flex-1 flex items-center gap-2 max-w-lg">
          <div className="flex-1 relative">
            <input
              type="text"
              value={auraInput}
              onChange={(e) => setAuraInput(e.target.value)}
              placeholder={isAuraProcessing ? `${config.appName} is thinking…` : `Ask ${config.appName} anything… e.g. "generate a quiz"`}
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
            className="flex items-center"
            title={showAIPanel ? `Close ${config.appName} panel` : `Open ${config.appName} & History`}
          >
            <Brain className="w-3.5 h-3.5 mr-1.5" />
            {config.appName}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center"
          >
            <Mic className="w-3.5 h-3.5 mr-1.5" />
            Transcript
            <span className="relative flex h-2 w-2 ml-2 flex-shrink-0 self-center">
              {isRecording && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-500 opacity-75" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
            </span>
          </Button>
        </div>
      </footer>

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
