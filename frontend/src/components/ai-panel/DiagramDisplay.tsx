'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Copy, CheckCheck, AlertCircle, Loader2, FlaskConical, GitBranch } from 'lucide-react'
import type { DiagramData } from '@/types'

/**
 * Fix common AI-generated Mermaid syntax errors before sending to the renderer.
 */
function fixMermaidSyntax(code: string): string {
  // Strip markdown fences
  code = code.replace(/```(?:mermaid)?\s*/gi, '').replace(/```/g, '')
  // Fix: -->|label|> B  →  -->|label| B  (stray > after closing pipe)
  code = code.replace(/\|([^|\n]*)\|>/g, '|$1| ')
  // If the whole diagram is on one line with semicolons as separators, split it
  if (!code.includes('\n') && code.includes(';')) {
    code = code.replace(/;\s*/g, '\n')
  }
  // Remove duplicate blank lines
  code = code.replace(/\n{3,}/g, '\n\n')
  return code.trim()
}

interface DiagramDisplayProps {
  data: DiagramData
}

export function DiagramDisplay({ data }: DiagramDisplayProps) {
  // ── State ─────────────────────────────────────────────────
  const [renderedSvg, setRenderedSvg] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(true)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [chemImgLoaded, setChemImgLoaded] = useState(false)
  const [chemImgError, setChemImgError] = useState(false)

  // ── Mermaid rendering ──────────────────────────────────────
  // Key fix: store the SVG in state so it's available when the container renders.
  // The old approach set innerHTML on a ref that didn't exist yet (it was behind
  // the loading-state gate), so the diagram area was always blank.
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
          theme: 'dark',
          darkMode: true,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 14,
          themeVariables: {
            background: '#1B1B1F',
            mainBkg: '#202127',
            nodeBorder: '#3b3b32',
            clusterBkg: '#202127',
            titleColor: '#DFDFD6',
            edgeLabelBackground: '#202127',
            primaryColor: '#4f46e5',
            primaryTextColor: '#DFDFD6',
            primaryBorderColor: '#4f46e5',
            lineColor: '#6d6d64',
            secondaryColor: '#202127',
            tertiaryColor: '#1B1B1F',
          },
        })

        const cleanCode = fixMermaidSyntax(data.code!)
        const uniqueId = `mermaid-${Date.now()}`
        const { svg } = await mermaid.render(uniqueId, cleanCode)

        // Store SVG in state — React will paint it on next render
        setRenderedSvg(svg)
        setIsRendering(false)
      } catch (err: any) {
        console.error('Mermaid render error:', err)
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
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.title ?? 'diagram'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Chemistry ──────────────────────────────────────────────
  const pubchemUrl = data.compoundName
    ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(data.compoundName)}/PNG?image_size=large`
    : null
  const isChemistry = data.diagramType === 'chemistry'

  // ── Render ─────────────────────────────────────────────────
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

      {/* Description */}
      {data.description && (
        <p className="text-xs text-dark-300 leading-relaxed">{data.description}</p>
      )}

      {/* ── Chemistry: PubChem image ── */}
      {isChemistry && (
        <div className="rounded-xl border border-dark-700 bg-dark-900/60 overflow-hidden">
          {pubchemUrl && !chemImgError ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <div className="bg-white rounded-lg p-3 w-full flex items-center justify-center min-h-[160px]">
                {!chemImgLoaded && (
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                )}
                <img
                  src={pubchemUrl}
                  alt={`Chemical structure of ${data.compoundName}`}
                  onLoad={() => setChemImgLoaded(true)}
                  onError={() => setChemImgError(true)}
                  className={`max-w-full max-h-64 object-contain transition-opacity ${chemImgLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
                />
              </div>
              <div className="text-center space-y-1 w-full">
                {data.smiles && (
                  <p className="text-xs text-dark-300">
                    <span className="text-dark-400">SMILES: </span>
                    <span className="font-mono text-emerald-400">{data.smiles}</span>
                  </p>
                )}
                <p className="text-[10px] text-dark-500">Source: PubChem (NIH)</p>
              </div>
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

      {/* ── Mermaid diagram ── */}
      {!isChemistry && (
        <div className="space-y-3">

          {/* Toolbar — only shown when rendered */}
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
                <Download className="w-3 h-3" />
                SVG
              </button>
            </div>
          )}

          {/* Diagram area */}
          <div className="rounded-xl border border-dark-700 bg-dark-900/60 overflow-hidden">
            <AnimatePresence mode="wait">
              {isRendering ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2 py-16"
                >
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  <span className="text-sm text-dark-400">Rendering diagram…</span>
                </motion.div>
              ) : renderError ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-5 space-y-3"
                >
                  <div className="flex items-start gap-2 text-amber-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-xs">Render failed — showing source code instead.</p>
                  </div>
                  <pre className="text-xs font-mono text-dark-300 bg-dark-800 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {data.code}
                  </pre>
                </motion.div>
              ) : renderedSvg ? (
                <motion.div
                  key="diagram"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 overflow-x-auto [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: renderedSvg }}
                />
              ) : null}
            </AnimatePresence>
          </div>

          {/* Source code — collapsible */}
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
    </div>
  )
}
