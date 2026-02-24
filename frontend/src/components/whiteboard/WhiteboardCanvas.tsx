'use client'

import { useEffect, useRef, useState } from 'react'
import { Tldraw, Editor, exportToBlob, getSnapshot, loadSnapshot } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { wsClient } from '@/lib/websocket'

interface WhiteboardCanvasProps {
  sessionId: string
  isRecording: boolean
}

const storageKey = (id: string) => `aura-whiteboard-${id}`

export function WhiteboardCanvas({ sessionId, isRecording }: WhiteboardCanvasProps) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [pageNumber]        = useState(1)
  const intervalTimer       = useRef<NodeJS.Timeout | null>(null)

  const saveState = (e: Editor) => {
    try {
      const snapshot = getSnapshot(e.store)
      localStorage.setItem(storageKey(sessionId), JSON.stringify(snapshot))
    } catch (err) {
      console.warn('Could not save whiteboard state:', err)
    }
  }

  const handleMount = (e: Editor) => {
    setEditor(e)
    // ── Preset user preferences ──────────────────────────────
    e.user.updateUserPreferences({
      colorScheme:        'dark',    // dark theme
      isSnapMode:         false,     // no auto-snap (free drawing)
      isDynamicSizeMode:  false,     // fixed brush size
      isPasteAtCursorMode: true,     // paste where cursor is
      isWrapMode:         false,     // no wrap-select
      edgeScrollSpeed:    1,         // smooth edge scrolling on
    })

    // ── Preset instance/editor state ─────────────────────────
    e.updateInstanceState({
      isDebugMode: false,   // no debug overlay
      isGridMode:  true,    // grid on — looks better
      isFocusMode: false,   // keep UI visible
    })

    // ── Restore saved whiteboard state first ─────────────────
    try {
      const saved = localStorage.getItem(storageKey(sessionId))
      if (saved) {
        loadSnapshot(e.store, JSON.parse(saved))
        console.log('📂 Whiteboard state restored')
      }
    } catch (err) {
      console.warn('Could not restore whiteboard state:', err)
    }

    // ── Camera — set AFTER snapshot ───────────────────────────
    e.setCameraOptions({
      constraints: {
        bounds:       { x: 0, y: 0, w: 5000, h: 999999 },
        padding:      { x: 0, y: 0 },
        origin:       { x: 0, y: 0 },
        initialZoom:  'default',
        baseZoom:     'default',
        behavior:     'contain',
      },
      isLocked: false,
      zoomSpeed: 1,
      panSpeed:  1,
    })
    e.setCamera({ x: 0, y: 0, z: 1 }, { animation: { duration: 0 } })
  }

  // Screenshot + save every 30s during recording
  useEffect(() => {
    if (!editor || !isRecording) return

    intervalTimer.current = setInterval(() => {
      console.log('📸 30s snapshot...')
      saveState(editor)
      captureSnapshot()
    }, 30000)

    return () => {
      if (intervalTimer.current) clearInterval(intervalTimer.current)
    }
  }, [editor, isRecording, sessionId])

  // Save on unmount
  useEffect(() => {
    if (!editor) return
    return () => { saveState(editor) }
  }, [editor])

  const captureSnapshot = async () => {
    if (!editor) return

    try {
      const shapeIds = Array.from(editor.getCurrentPageShapeIds())
      let imageData: string

      if (shapeIds.length === 0) {
        const canvas = document.createElement('canvas')
        canvas.width = 1280
        canvas.height = 720
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#1B1B1F'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#555'
        ctx.font = '24px sans-serif'
        ctx.fillText('(empty canvas)', 40, 40)
        imageData = canvas.toDataURL('image/png')
      } else {
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

      console.log(`✅ Whiteboard captured (${(imageData.length / 1024).toFixed(1)} KB)`)
      wsClient.sendCanvasSnapshot(sessionId, null, imageData, pageNumber)
    } catch (error) {
      console.error('❌ Snapshot failed:', error)
    }
  }

  return (
    <div className="w-full h-full" data-color-mode="dark">
      <Tldraw onMount={handleMount} autoFocus />
    </div>
  )
}
