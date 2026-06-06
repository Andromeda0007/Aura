'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Copy, CheckCheck, AlertCircle, Loader2, FlaskConical, GitBranch, LayoutPanelLeft } from 'lucide-react'
import type { DiagramData } from '@/types'

function fixMermaidSyntax(code: string): string {
  code = code.replace(/```(?:mermaid)?\s*/gi, '').replace(/```/g, '')
  // Fix broken edge label syntax  |text|>  →  |text|
  code = code.replace(/\|([^|\n]*)\|>/g, '|$1| ')
  // Trim whitespace inside node labels  [ text ]  →  [text]
  code = code.replace(/\[\s+([^\]]*?)\s+\]/g, '[$1]')
  // Semicolon-separated single-line → newlines
  if (!code.includes('\n') && code.includes(';')) code = code.replace(/;\s*/g, '\n')
  // Collapse triple+ blank lines
  code = code.replace(/\n{3,}/g, '\n\n')
  return code.trim()
}

/** Remove any error divs Mermaid injects into document.body on parse failure. */
function cleanMermaidErrors() {
  document.querySelectorAll(
    '[id^="mermaid-"], .mermaid-error, #d, .error-text, svg[id^="mermaid-"]'
  ).forEach(el => {
    if (el.closest('#__next') === null) el.remove()
  })
}

interface DiagramDisplayProps {
  data: DiagramData
  onBoardAction?: (mode: 'add' | 'replace', dataUrl: string) => void
}

export function DiagramDisplay({ data, onBoardAction }: DiagramDisplayProps) {
  const [renderedSvg, setRenderedSvg]     = useState<string | null>(null)
  const [isRendering, setIsRendering]     = useState(true)
  const [renderError, setRenderError]     = useState<string | null>(null)
  const [copied, setCopied]               = useState(false)
  const [chemImgLoaded, setChemImgLoaded] = useState(false)
  const [chemImgError, setChemImgError]   = useState(false)
  const [placing, setPlacing]             = useState(false)

  // ── Mermaid ────────────────────────────────────────────────
  useEffect(() => {
    if (data.diagramType !== 'mermaid' || !data.code) return
    setIsRendering(true)
    setRenderError(null)
    setRenderedSvg(null)

    const render = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            background:          '#ffffff',
            mainBkg:             '#f0f4ff',
            nodeBorder:          '#6366f1',
            clusterBkg:          '#e8edff',
            titleColor:          '#1e1b4b',
            edgeLabelBackground: '#f0f4ff',
            primaryColor:        '#6366f1',
            primaryTextColor:    '#1e1b4b',
            primaryBorderColor:  '#6366f1',
            lineColor:           '#818cf8',
            secondaryColor:      '#e0e7ff',
            tertiaryColor:       '#f5f3ff',
            fontSize:            '15px',
          },
          flowchart: { curve: 'basis', padding: 20 },
        })

        const cleanCode = fixMermaidSyntax(data.code!)
        const uniqueId  = `mermaid-${Date.now()}`
        const { svg }   = await mermaid.render(uniqueId, cleanCode)
        setRenderedSvg(svg)
        setIsRendering(false)
      } catch (err: any) {
        // Mermaid sometimes injects error elements into document.body — remove them
        cleanMermaidErrors()
        setRenderError(err?.message ?? 'Could not render diagram.')
        setIsRendering(false)
      }
    }
    render()
  }, [data.code, data.diagramType])

  // ── Actions ────────────────────────────────────────────────
  const handleCopyCode = () => {
    if (data.code) {
      navigator.clipboard.writeText(data.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownloadSVG = () => {
    if (!renderedSvg) return
    const blob = new Blob([renderedSvg], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${data.title ?? 'diagram'}.svg`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleAddToBoard = async () => {
    if (!onBoardAction || placing) return
    setPlacing(true)
    try {
      let dataUrl = ''
      if (data.diagramType === 'mermaid' && renderedSvg) {
        const svgWithBg = renderedSvg.replace(
          '<svg ',
          '<svg style="background:#ffffff;border-radius:8px;padding:12px;" '
        )
        dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgWithBg)))}`
      } else if (data.diagramType === 'chemistry' && data.compoundName) {
        const url  = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(data.compoundName)}/PNG?image_size=large`
        const resp = await fetch(url)
        const blob = await resp.blob()
        dataUrl    = await new Promise<string>(res => {
          const r = new FileReader(); r.onloadend = () => res(r.result as string); r.readAsDataURL(blob)
        })
      }
      if (dataUrl) onBoardAction('add', dataUrl)
    } catch (err) {
      console.error('Board paste failed:', err)
    } finally {
      setPlacing(false)
    }
  }

  // ── Chemistry ──────────────────────────────────────────────
  const pubchemUrl  = data.compoundName
    ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(data.compoundName)}/PNG?image_size=large`
    : null
  const isChemistry = data.diagramType === 'chemistry'
  const canBoard    = onBoardAction && (isChemistry ? !!pubchemUrl && !chemImgError : !!renderedSvg)

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
          isChemistry
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
        }`}>
          {isChemistry ? <FlaskConical className="w-4 h-4" /> : <GitBranch className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${
            isChemistry ? 'text-emerald-400' : 'text-indigo-400'
          }`}>
            {isChemistry ? 'Chemical Structure' : 'Diagram'}
          </p>
          {data.title && <h3 className="text-sm font-bold text-dark-50 truncate">{data.title}</h3>}
        </div>
      </div>

      {data.description && (
        <p className="text-xs text-dark-300 leading-relaxed">{data.description}</p>
      )}

      {/* ── Chemistry ── */}
      {isChemistry && (
        <div className="rounded-xl border border-dark-700 bg-dark-900/60 overflow-hidden">
          {pubchemUrl && !chemImgError ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <div className="bg-white rounded-lg p-3 w-full flex items-center justify-center min-h-[200px]">
                {!chemImgLoaded && <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />}
                <img
                  src={pubchemUrl}
                  alt={`Chemical structure of ${data.compoundName}`}
                  onLoad={() => setChemImgLoaded(true)}
                  onError={() => setChemImgError(true)}
                  className={`max-w-full max-h-72 object-contain transition-opacity ${chemImgLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
                />
              </div>
              {data.smiles && (
                <p className="text-xs text-dark-300 w-full">
                  <span className="text-dark-400">SMILES: </span>
                  <span className="font-mono text-emerald-400">{data.smiles}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="p-6 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-dark-500 mx-auto" />
              <p className="text-sm text-dark-300">Could not load structure image.</p>
              {data.smiles && (
                <p className="text-xs text-dark-400 font-mono bg-dark-800 px-3 py-2 rounded-lg inline-block">
                  SMILES: {data.smiles}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Mermaid ── */}
      {!isChemistry && (
        <div className="space-y-3">
          {!isRendering && !renderError && renderedSvg && (
            <div className="flex items-center gap-1.5 justify-end">
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-[10px] text-dark-400 hover:text-dark-200 transition-colors px-2 py-1 rounded-md hover:bg-dark-700"
              >
                {copied ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy code'}
              </button>
              <button
                onClick={handleDownloadSVG}
                className="flex items-center gap-1 text-[10px] text-dark-400 hover:text-dark-200 transition-colors px-2 py-1 rounded-md hover:bg-dark-700"
              >
                <Download className="w-3 h-3" /> SVG
              </button>
            </div>
          )}

          <div className="rounded-xl border border-dark-700 bg-white overflow-hidden">
            <AnimatePresence mode="wait">
              {isRendering ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2 py-16">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  <span className="text-sm text-gray-500">Rendering diagram…</span>
                </motion.div>
              ) : renderError ? (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-3">
                  <div className="flex items-start gap-2 text-amber-600">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-xs">Render failed — showing source code instead.</p>
                  </div>
                  <pre className="text-xs font-mono text-gray-600 bg-gray-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {data.code}
                  </pre>
                </motion.div>
              ) : renderedSvg ? (
                <motion.div
                  key="diagram"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 overflow-x-auto [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-full [&_svg]:min-h-[200px]"
                  dangerouslySetInnerHTML={{ __html: renderedSvg }}
                />
              ) : null}
            </AnimatePresence>
          </div>

          {!renderError && data.code && (
            <details className="group">
              <summary className="text-[10px] text-dark-500 cursor-pointer hover:text-dark-300 transition-colors select-none list-none flex items-center gap-1">
                <span className="group-open:hidden">▶ View source</span>
                <span className="hidden group-open:inline">▼ Hide source</span>
              </summary>
              <pre className="mt-2 text-xs font-mono text-dark-400 bg-dark-900 border border-dark-700 p-3 rounded-lg overflow-x-auto whitespace-pre">
                {data.code}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* ── Add to Board ── */}
      {canBoard && (
        <div className="pt-1">
          <button
            onClick={handleAddToBoard}
            disabled={placing}
            className="flex items-center gap-2 text-xs bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {placing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <LayoutPanelLeft className="w-3.5 h-3.5" />}
            {placing ? 'Adding…' : 'Add to Board'}
          </button>
        </div>
      )}

    </div>
  )
}
