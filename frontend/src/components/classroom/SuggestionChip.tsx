'use client'

interface SuggestionChipProps {
  label: string
  onAccept: () => void
  onDismiss: () => void
}

export function SuggestionChip({ label, onAccept, onDismiss }: SuggestionChipProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-dark-800 border border-primary-500/40 rounded-full px-3 py-1.5 shadow-lg animate-fade-in">
      <span className="text-xs text-primary-400 font-medium">{label}</span>
      <button
        onClick={onAccept}
        className="text-xs bg-primary-500 hover:bg-primary-600 text-white px-2 py-0.5 rounded-full transition-colors"
      >
        Ask Aura
      </button>
      <button
        onClick={onDismiss}
        className="text-xs text-dark-400 hover:text-dark-200 px-1 transition-colors"
      >
        ✕
      </button>
    </div>
  )
}
