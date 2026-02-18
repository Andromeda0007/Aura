import { io, Socket } from 'socket.io-client'
import type { WSMessage, WSMessageType } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'

class WebSocketClient {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private messageHandlers: Map<WSMessageType, Set<(data: any) => void>> = new Map()

  connect(sessionId: string, token: string): void {
    if (this.socket?.connected) {
      console.log('WebSocket already connected')
      return
    }

    this.socket = io(WS_URL, {
      auth: { token },
      query: { session_id: sessionId },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
    })

    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.reconnectAttempts++
    })

    this.socket.on('message', (message: WSMessage) => {
      this.handleMessage(message)
    })

    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error)
      this.notifyHandlers('error', error)
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.messageHandlers.clear()
    }
  }

  send(type: WSMessageType, data: any): void {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected')
      return
    }

    const message: WSMessage = {
      type,
      data,
      timestamp: new Date().toISOString(),
    }

    this.socket.emit('message', message)
  }

  on(type: WSMessageType, handler: (data: any) => void): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)!.add(handler)

    return () => {
      this.messageHandlers.get(type)?.delete(handler)
    }
  }

  private handleMessage(message: WSMessage): void {
    this.notifyHandlers(message.type, message.data)
  }

  private notifyHandlers(type: WSMessageType, data: any): void {
    const handlers = this.messageHandlers.get(type)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data)
        } catch (error) {
          console.error(`Error in message handler for ${type}:`, error)
        }
      })
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  sendAudioChunk(sessionId: string, audioData: string, chunkId: number): void {
    this.send('audio_chunk', {
      sessionId,
      data: audioData,
      timestamp: new Date().toISOString(),
      chunkId,
    })
  }

  sendCanvasSnapshot(sessionId: string, tldrawState: any, imageData: string, pageNumber: number): void {
    this.send('canvas_snapshot', {
      sessionId,
      tldrawState,
      imageData,
      timestamp: new Date().toISOString(),
      pageNumber,
    })
  }

  sendTranscriptText(sessionId: string, text: string): void {
    this.send('transcript_text', {
      sessionId,
      text,
      timestamp: new Date().toISOString(),
    })
  }

  sendVoiceCommand(sessionId: string, command: string): void {
    this.send('voice_command', {
      sessionId,
      command,
      timestamp: new Date().toISOString(),
    })
  }

  ping(): void {
    this.send('ping', {})
  }
}

export const wsClient = new WebSocketClient()
