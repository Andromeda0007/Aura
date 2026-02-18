'use client'

import { useEffect, useRef } from 'react'
import { wsClient } from '@/lib/websocket'

interface AudioCaptureProps {
  sessionId: string
  onError: (error: string) => void
  onLiveTranscript?: (text: string, isFinal: boolean) => void
}

export function AudioCapture({ sessionId, onError, onLiveTranscript }: AudioCaptureProps) {
  const recognition         = useRef<any>(null)
  const isActive            = useRef(false)
  const onLiveTranscriptRef = useRef(onLiveTranscript)
  useEffect(() => { onLiveTranscriptRef.current = onLiveTranscript }, [onLiveTranscript])

  useEffect(() => {
    isActive.current = true
    startRecognition()
    return () => {
      isActive.current = false
      recognition.current?.stop()
    }
  }, [])

  const startRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      onError('Speech recognition not supported. Please use Chrome or Edge.')
      return
    }

    const rec = new SR()
    recognition.current = rec
    rec.continuous      = true
    rec.interimResults  = true
    rec.lang            = 'en-US'
    rec.maxAlternatives = 1

    rec.onstart = () => {
      console.log('🎙️ Speech recognition active')
      onLiveTranscriptRef.current?.('🎙 Listening…', false)
    }

    rec.onresult = (e: any) => {
      let interim = ''
      let final   = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }

      if (interim) onLiveTranscriptRef.current?.(interim.trim(), false)

      if (final.trim()) {
        const text = final.trim()
        onLiveTranscriptRef.current?.(text, true)
        // Send plain text to backend for storage
        wsClient.sendTranscriptText(sessionId, text)
        console.log(`📤 Transcript → backend: "${text.slice(0, 80)}"`)
      }
    }

    rec.onerror = (e: any) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return
      console.error('Speech recognition error:', e.error)
      if (e.error === 'not-allowed') onError('Microphone permission denied.')
    }

    rec.onend = () => {
      // Only restart if THIS instance is still the active one.
      // Prevents StrictMode double-mount: old rec's onend fires after new mount
      // sets isActive=true, which would cause a runaway restart loop.
      if (isActive.current && recognition.current === rec) {
        setTimeout(() => {
          if (isActive.current && recognition.current === rec) {
            try { rec.start() } catch (_) {}
          }
        }, 300)
      }
    }

    try { rec.start() } catch (e) { console.error('Failed to start speech recognition:', e) }
  }

  return null
}
