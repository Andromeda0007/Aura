import { create } from 'zustand'
import type { Session, Command, AIResponse, CompressionNotification } from '@/types'

export interface TranscriptEntry {
  id: string
  text: string
  timestamp: string
  isFinal: boolean
}

interface SessionState {
  currentSession: Session | null
  isRecording: boolean
  commands: Command[]
  latestAIResponse: AIResponse | null
  aiHistory: AIResponse[]
  compressionStatus: CompressionNotification | null
  transcriptEntries: TranscriptEntry[]

  setCurrentSession: (session: Session | null) => void
  setRecording: (recording: boolean) => void
  addCommand: (command: Command) => void
  updateCommand: (commandId: string, updates: Partial<Command>) => void
  setLatestAIResponse: (response: AIResponse | null) => void
  addToAIHistory: (response: AIResponse) => void
  clearAIHistory: () => void
  setCompressionStatus: (status: CompressionNotification | null) => void
  addTranscriptEntry: (entry: TranscriptEntry) => void
  updateTranscriptEntry: (id: string, updates: Partial<TranscriptEntry>) => void
  clearTranscript: () => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  currentSession: null,
  isRecording: false,
  commands: [],
  latestAIResponse: null,
  aiHistory: [],
  compressionStatus: null,
  transcriptEntries: [],

  setCurrentSession: (session) => set({ currentSession: session }),

  setRecording: (recording) => set({ isRecording: recording }),

  addCommand: (command) => set((state) => ({
    commands: [...state.commands, command],
  })),

  updateCommand: (commandId, updates) => set((state) => ({
    commands: state.commands.map((cmd) =>
      cmd.id === commandId ? { ...cmd, ...updates } : cmd
    ),
  })),

  setLatestAIResponse: (response) => set({ latestAIResponse: response }),

  addToAIHistory: (response) => set((state) => ({
    aiHistory: [...state.aiHistory, response],
  })),

  clearAIHistory: () => set({ aiHistory: [] }),

  setCompressionStatus: (status) => set({ compressionStatus: status }),

  addTranscriptEntry: (entry) => set((state) => ({
    transcriptEntries: [...state.transcriptEntries, entry],
  })),

  updateTranscriptEntry: (id, updates) => set((state) => ({
    transcriptEntries: state.transcriptEntries.map((entry) =>
      entry.id === id ? { ...entry, ...updates } : entry
    ),
  })),

  clearTranscript: () => set({ transcriptEntries: [] }),

  clearSession: () => set({
    currentSession: null,
    isRecording: false,
    commands: [],
    latestAIResponse: null,
    aiHistory: [],
    compressionStatus: null,
    transcriptEntries: [],
  }),
}))
