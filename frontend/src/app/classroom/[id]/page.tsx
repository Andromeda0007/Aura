'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Mic, MicOff, Play, Square, Home, Brain } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { api } from '@/lib/api'
import { wsClient } from '@/lib/websocket'
import { useAuthStore } from '@/store/authStore'
import { useSessionStore } from '@/store/sessionStore'
import { WhiteboardCanvas } from '@/components/whiteboard/WhiteboardCanvas'
import { AIPanel } from '@/components/ai-panel/AIPanel'
import { VoiceIndicator } from '@/components/voice/VoiceIndicator'
import { AudioCapture } from '@/components/audio/AudioCapture'
import { CompressionNotification } from '@/components/classroom/CompressionNotification'
import { LiveTranscript } from '@/components/transcript/LiveTranscript'
import type { Session } from '@/types'
import toast from 'react-hot-toast'

export default function ClassroomPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string
  
  const { user, tokens, isAuthenticated } = useAuthStore()
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
  } = useSessionStore()

  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !tokens) {
      router.push('/auth/login')
      return
    }
    initializeSession()
    return () => {
      cleanup()
    }
  }, [isAuthenticated, sessionId])

  const initializeSession = async () => {
    try {
      const session = await api.getSession(sessionId)
      setCurrentSession(session)
      
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
    useSessionStore.getState().setLatestAIResponse(data)
  }

  const handleError = (data: any) => {
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
    setShowTranscript(true)
    toast.success('Session started')
  }

  const handleStopRecording = () => {
    setRecording(false)
    setAudioEnabled(false)
    toast('Session paused', { icon: '⏸️' })
  }

  const handleEndSession = async () => {
    if (!confirm('Are you sure you want to end this session?')) return

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
      <header className="h-14 border-b border-dark-700 bg-dark-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
            <Home className="w-4 h-4 mr-2" />
            <span className="text-dark-50">Dashboard</span>
          </Button>
          <div className="h-6 w-px bg-dark-700" />
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary-500" />
            <span className="font-medium text-dark-50">{currentSession?.subject}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isRecording && <VoiceIndicator isActive={audioEnabled} />}
          
          <div className="h-6 w-px bg-dark-600" />
          
          {!isRecording ? (
            <Button variant="primary" size="md" onClick={handleStartRecording}>
              <Play className="w-4 h-4 mr-2" />
              Start
            </Button>
          ) : (
            <Button variant="secondary" size="md" onClick={handleStopRecording}>
              <Square className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}

          <Button variant="outline" size="md" onClick={handleEndSession}>
            End Session
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <WhiteboardCanvas sessionId={sessionId} isRecording={isRecording} />
        </div>

        {latestAIResponse && (
          <AIPanel response={latestAIResponse} onClose={() => useSessionStore.getState().setLatestAIResponse(null)} />
        )}
      </div>

      <footer className="h-16 border-t border-dark-700 bg-dark-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-4 text-sm text-dark-200">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-primary-500' : 'bg-red-500'}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div>Tokens: {currentSession?.activeBufferTokens.toLocaleString() || 0} / 10,000</div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTranscript(!showTranscript)}
            className="relative"
          >
            <Mic className="w-4 h-4 mr-2" />
            Transcript
            {transcriptEntries.length > 0 && (
              <span className="ml-2 bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">
                {transcriptEntries.length}
              </span>
            )}
          </Button>
          
          <span className="text-sm text-dark-200">
            Press Space or say "Hey Aura" to give commands
          </span>
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
    </div>
  )
}
