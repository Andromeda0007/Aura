'use client'

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { Tldraw, Editor, exportToBlob, getSnapshot, loadSnapshot, AssetRecordType } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { wsClient } from '@/lib/websocket'
import { storageKeys } from '@/lib/constants'

export interface WhiteboardCanvasRef {
  captureSnapshot:       () => Promise<string | null>
  exportCanvas:          () => Promise<string | null>
  addTextToBoard:        (text: string) => void
  addBlock:              (text: string) => void
  replaceWithBlocks:     (blocks: string[]) => void
  mergeBlockWithAnswer:  (shapeId: string, question: string, answer: string) => void
  getSelectedShape:      () => { id: string; text: string } | null
  addImageToBoard:       (dataUrl: string, mode: 'add' | 'replace') => Promise<void>
}

interface WhiteboardCanvasProps {
  sessionId: string
  isRecording: boolean
  onShapeSelected?: (shapeId: string | null, text: string | null) => void
}

// Dimensions for a topic block given its text
function blockHeight(text: string): number {
  const lines = text.split('\n').length + Math.ceil(text.length / 50)
  return Math.max(60, lines * 24 + 24)
}

export const WhiteboardCanvas = forwardRef<WhiteboardCanvasRef, WhiteboardCanvasProps>(
function WhiteboardCanvas({ sessionId, isRecording, onShapeSelected }, ref) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [pageNumber] = useState(1)
  const intervalTimer = useRef<NodeJS.Timeout | null>(null)
  const editorRef = useRef<Editor | null>(null)

  const saveState = (e: Editor) => {
    try {
      const snapshot = getSnapshot(e.store)
      localStorage.setItem(storageKeys.whiteboard(sessionId), JSON.stringify(snapshot))
    } catch (err) {
      console.warn('Could not save whiteboard state:', err)
    }
  }

  useImperativeHandle(ref, () => ({
    captureSnapshot: () => captureSnapshot(),
    exportCanvas:    () => exportCanvas(),

    addTextToBoard: (text: string) => {
      const e = editorRef.current
      if (!e) return
      const bounds = e.getViewportPageBounds()
      e.createShapes([{
        type: 'text',
        x: bounds.x + 60,
        y: bounds.y + 60,
        props: { text, color: 'violet', size: 's', font: 'sans', autoSize: true },
      }])
    },

    // Appends a single geo block below all existing shapes — non-destructive.
    addBlock: (text: string) => {
      const e = editorRef.current
      if (!e || !text.trim()) return

      const allShapes = Array.from(e.getCurrentPageShapeIds()).map(id => e.getShape(id)).filter(Boolean)
      let y = 80
      if (allShapes.length > 0) {
        const maxBottom = Math.max(...allShapes.map(s => {
          const b = e.getShapePageBounds(s!.id as any)
          return b ? b.maxY : 0
        }))
        y = maxBottom + 16
      }

      const W = 500
      const h = blockHeight(text)

      e.createShapes([{
        type: 'geo',
        x: 80,
        y,
        props: {
          geo: 'rectangle',
          w: W,
          h,
          color: 'light-violet',
          fill: 'semi',
          dash: 'draw',
          size: 's',
          text,
          font: 'draw',
          align: 'start',
          verticalAlign: 'start',
        },
      }])

      e.setCamera({ x: -40, y: -(y - 40), z: 1 }, { animation: { duration: 350 } })
    },

    // Convert handwriting (draw/pencil strokes) to clean blocks.
    // Existing geo blocks are KEPT — new blocks are appended below them.
    replaceWithBlocks: (blocks: string[]) => {
      const e = editorRef.current
      if (!e || blocks.length === 0) return

      const allShapes = Array.from(e.getCurrentPageShapeIds())
        .map(id => e.getShape(id))
        .filter(Boolean)

      // Delete only ink/pencil strokes and bare text shapes (not structured blocks)
      const inkIds = allShapes
        .filter(s => s!.type === 'draw' || s!.type === 'text')
        .map(s => s!.id)
      if (inkIds.length > 0) e.deleteShapes(inkIds as any)

      // Find the lowest Y of remaining shapes (existing blocks)
      const remaining = allShapes.filter(s => !inkIds.includes(s!.id))
      let startY = 80
      if (remaining.length > 0) {
        const maxBottom = Math.max(
          ...remaining.map(s => {
            const b = e.getShapePageBounds(s!.id as any)
            return b ? b.maxY : 0
          })
        )
        startY = maxBottom + 20
      }

      const W = 500
      const X = 80
      let y = startY

      for (const blockText of blocks) {
        if (!blockText.trim()) continue
        const h = blockHeight(blockText)
        e.createShapes([{
          type: 'geo',
          x: X,
          y,
          props: {
            geo: 'rectangle',
            w: W,
            h,
            color: 'light-violet',
            fill: 'semi',
            dash: 'draw',
            size: 's',
            text: blockText,
            font: 'draw',
            align: 'start',
            verticalAlign: 'start',
          },
        }])
        y += h + 14
      }
    },

    // Replace the question block with a single combined Q+A note block
    mergeBlockWithAnswer: (shapeId: string, question: string, answer: string) => {
      const e = editorRef.current
      if (!e || !answer.trim()) return

      const bounds = e.getShapePageBounds(shapeId as any)
      if (!bounds) return

      const combined = `${question}\n${'─'.repeat(18)}\n\n${answer}`
      const W = Math.max(bounds.w, 500)
      const h = blockHeight(combined)

      e.deleteShapes([shapeId as any])
      e.createShapes([{
        type: 'geo',
        x: bounds.x,
        y: bounds.y,
        props: {
          geo: 'rectangle',
          w: W,
          h,
          color: 'light-violet',
          fill: 'semi',
          dash: 'draw',
          size: 's',
          text: combined,
          font: 'sans',
          align: 'start',
          verticalAlign: 'start',
        },
      }])
    },

    getSelectedShape: () => {
      const e = editorRef.current
      if (!e) return null
      const shapes = e.getSelectedShapes()
      if (shapes.length !== 1) return null
      const text = ((shapes[0].props as any).text ?? '').trim()
      if (!text) return null
      return { id: shapes[0].id, text }
    },

    addImageToBoard: async (dataUrl: string, mode: 'add' | 'replace') => {
      const e = editorRef.current
      if (!e || !dataUrl) return

      if (mode === 'replace') {
        const allIds = Array.from(e.getCurrentPageShapeIds())
        if (allIds.length > 0) e.deleteShapes(allIds as any)
      }

      let insertY = 80
      const existingIds = Array.from(e.getCurrentPageShapeIds())
      if (existingIds.length > 0) {
        const maxBottom = Math.max(...existingIds.map(id => {
          const b = e.getShapePageBounds(id as any)
          return b ? b.maxY : 0
        }))
        insertY = maxBottom + 24
      }

      const W    = 600
      const H    = 420
      const isSvg = dataUrl.startsWith('data:image/svg')

      // Write asset + shape directly — avoids tldraw's CDN upload pipeline
      const assetId = AssetRecordType.createId()
      e.store.put([
        AssetRecordType.create({
          id: assetId,
          type: 'image',
          props: {
            name: 'diagram',
            src: dataUrl,
            w: W,
            h: H,
            mimeType: isSvg ? 'image/svg+xml' : 'image/png',
            isAnimated: false,
          },
        }),
      ])
      e.createShapes([{
        type: 'image',
        x: 80,
        y: insertY,
        props: { assetId, w: W, h: H, playing: false, url: '', crop: null, flipX: false, flipY: false } as any,
      }])
      e.setCamera({ x: -40, y: -(insertY - 40), z: 1 }, { animation: { duration: 400 } })
    },
  }))

  // Save on browser refresh/close
  useEffect(() => {
    const save = () => { if (editorRef.current) saveState(editorRef.current) }
    window.addEventListener('beforeunload', save)
    return () => window.removeEventListener('beforeunload', save)
  }, [sessionId])

  const handleMount = (e: Editor) => {
    setEditor(e)
    editorRef.current = e

    e.user.updateUserPreferences({
      colorScheme:         'dark',
      isSnapMode:          false,
      isDynamicSizeMode:   false,
      isPasteAtCursorMode: true,
      isWrapMode:          false,
      edgeScrollSpeed:     1,
    })
    e.updateInstanceState({ isDebugMode: false, isGridMode: true, isFocusMode: false })

    // Restore saved whiteboard state
    try {
      const saved = localStorage.getItem(storageKeys.whiteboard(sessionId))
      if (saved) loadSnapshot(e.store, JSON.parse(saved))
    } catch (err) {
      console.warn('Could not restore whiteboard state:', err)
    }

    // Auto-save on every user edit (3s throttle)
    let saveTimer: ReturnType<typeof setTimeout> | null = null
    const unsubSave = e.store.listen(
      () => {
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(() => saveState(e), 3000)
      },
      { source: 'user', scope: 'document' }
    )

    // Track selected shape and notify parent
    let lastSelectedId: string | null = null
    const unsubSel = e.store.listen(() => {
      const shapes = e.getSelectedShapes()
      const newId = shapes.length === 1 ? shapes[0].id : null
      if (newId !== lastSelectedId) {
        lastSelectedId = newId
        if (newId) {
          const text = ((shapes[0].props as any).text ?? '').trim() || null
          onShapeSelected?.(newId, text)
        } else {
          onShapeSelected?.(null, null)
        }
      }
    })

    ;(e as any).__cleanup = () => {
      unsubSave()
      unsubSel()
      if (saveTimer) clearTimeout(saveTimer)
    }

    e.setCameraOptions({
      constraints: {
        bounds:      { x: 0, y: 0, w: 2000, h: 50000 },
        padding:     { x: 0, y: 0 },
        origin:      { x: 0, y: 0 },
        initialZoom: 'default',
        baseZoom:    'default',
        behavior:    'contain',
      },
      isLocked: false, zoomSpeed: 1, panSpeed: 1,
    })
    e.setCamera({ x: 0, y: 0, z: 1 }, { animation: { duration: 0 } })
  }

  // Screenshot + save every 10s during recording
  useEffect(() => {
    if (!editor || !isRecording) return
    captureSnapshot()
    intervalTimer.current = setInterval(() => {
      saveState(editor)
      captureSnapshot()
    }, 10000)
    return () => { if (intervalTimer.current) clearInterval(intervalTimer.current) }
  }, [editor, isRecording, sessionId])

  // Save + cleanup on unmount
  useEffect(() => {
    if (!editor) return
    return () => {
      saveState(editor)
      ;(editor as any).__cleanup?.()
    }
  }, [editor])

  // Export canvas to base64 PNG without sending to the backend
  const exportCanvas = async (): Promise<string | null> => {
    if (!editor) return null
    try {
      const shapeIds = Array.from(editor.getCurrentPageShapeIds())
      if (shapeIds.length === 0) {
        const canvas = document.createElement('canvas')
        canvas.width = 1280; canvas.height = 720
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#1B1B1F'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#555'
        ctx.font = '24px sans-serif'
        ctx.fillText('(empty canvas)', 40, 40)
        return canvas.toDataURL('image/png')
      }
      const blob = await exportToBlob({
        editor, ids: shapeIds, format: 'png',
        opts: { background: true, scale: 1 },
      })
      return await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('Export failed:', error)
      return null
    }
  }

  // Export + send to vision worker
  const captureSnapshot = async (): Promise<string | null> => {
    const imageData = await exportCanvas()
    if (imageData) wsClient.sendCanvasSnapshot(sessionId, null, imageData, pageNumber)
    return imageData
  }

  return (
    <div className="w-full h-full" data-color-mode="dark">
      <Tldraw onMount={handleMount} autoFocus />
    </div>
  )
})
