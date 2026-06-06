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
  const silenceTimer        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingInterim      = useRef('')

  useEffect(() => { onLiveTranscriptRef.current = onLiveTranscript }, [onLiveTranscript])

  useEffect(() => {
    isActive.current = true
    startRecognition()
    return () => {
      isActive.current = false
      if (silenceTimer.current) clearTimeout(silenceTimer.current)
      recognition.current?.stop()
    }
  }, [])

  const flushInterim = () => {
    const text = pendingInterim.current.trim()
    if (!text) return
    pendingInterim.current = ''
    onLiveTranscriptRef.current?.(text, true)
    wsClient.sendTranscriptText(sessionId, text)
  }

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
      onLiveTranscriptRef.current?.('Listening...', false)
    }

    rec.onresult = (e: any) => {
      let interim = ''
      let final   = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }

      if (interim) {
        pendingInterim.current = (pendingInterim.current + ' ' + interim).trim()
        onLiveTranscriptRef.current?.(pendingInterim.current, false)
        if (silenceTimer.current) clearTimeout(silenceTimer.current)
        silenceTimer.current = setTimeout(flushInterim, 2000)
      }

      if (final.trim()) {
        if (silenceTimer.current) clearTimeout(silenceTimer.current)
        pendingInterim.current = ''
        const text = final.trim()
        onLiveTranscriptRef.current?.(text, true)
        wsClient.sendTranscriptText(sessionId, text)
      }
    }

    rec.onerror = (e: any) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return
      console.error('Speech recognition error:', e.error)
      if (e.error === 'not-allowed') onError('Microphone permission denied.')
    }

    rec.onend = () => {
      flushInterim()
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
