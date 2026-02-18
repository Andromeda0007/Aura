'use client'

import { useEffect, useRef, useState } from 'react'
import { Tldraw, Editor, exportToBlob } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { wsClient } from '@/lib/websocket'

interface WhiteboardCanvasProps {
  sessionId: string
  isRecording: boolean
}

export function WhiteboardCanvas({ sessionId, isRecording }: WhiteboardCanvasProps) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const intervalTimer = useRef<NodeJS.Timeout | null>(null)

  // Screenshot every 30 seconds — simple, no activity tracking
  useEffect(() => {
    if (!editor || !isRecording) return

    intervalTimer.current = setInterval(() => {
      console.log('📸 30s snapshot...')
      captureSnapshot()
    }, 30000)

    return () => {
      if (intervalTimer.current) clearInterval(intervalTimer.current)
    }
  }, [editor, isRecording, sessionId])

  const captureSnapshot = async () => {
    if (!editor) return

    try {
      const shapeIds = Array.from(editor.getCurrentPageShapeIds())

      let imageData: string

      if (shapeIds.length === 0) {
        // Empty canvas — blank placeholder image
        const canvas = document.createElement('canvas')
        canvas.width = 1280
        canvas.height = 720
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#aaaaaa'
        ctx.font = '24px sans-serif'
        ctx.fillText('(empty canvas)', 40, 40)
        imageData = canvas.toDataURL('image/png')
        console.log('📷 Empty canvas captured as blank image')
      } else {
        // Use tldraw's own exporter — handles embedded images & SVG quirks correctly
        const blob = await exportToBlob({
          editor,
          ids: shapeIds,
          format: 'png',
          opts: { background: true, scale: 1 },
        })
        imageData = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      }

      const sizeKB = (imageData.length / 1024).toFixed(1)
      console.log(`✅ Whiteboard captured (${sizeKB} KB), sending to backend...`)

      // Only send image + minimal metadata (not full tldraw state which can be huge)
      wsClient.sendCanvasSnapshot(sessionId, null, imageData, pageNumber)
    } catch (error) {
      console.error('❌ Snapshot failed:', error)
    }
  }

  return (
    <div className="w-full h-full">
      <Tldraw
        onMount={setEditor}
        autoFocus
        hideUi={false}
      />
    </div>
  )
}
