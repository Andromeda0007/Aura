import { create } from "zustand";

import type { AIResponse, CompressionStatus, Session, TranscriptEntry } from "@/types";

interface SessionState {
  currentSession: Session | null;
  isRecording: boolean;
  transcripts: TranscriptEntry[];
  aiHistory: AIResponse[];
  latestResponse: AIResponse | null;
  compression: CompressionStatus | null;

  setSession: (s: Session | null) => void;
  setRecording: (v: boolean) => void;
  addTranscript: (t: TranscriptEntry) => void;
  setTranscripts: (t: TranscriptEntry[]) => void;
  setStar: (id: string, starred: boolean) => void;
  addResponse: (r: AIResponse) => void;
  setCompression: (c: CompressionStatus | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentSession: null,
  isRecording: false,
  transcripts: [],
  aiHistory: [],
  latestResponse: null,
  compression: null,

  setSession: (currentSession) => set({ currentSession }),
  setRecording: (isRecording) => set({ isRecording }),
  addTranscript: (t) =>
    set((s) => {
      // Replace a trailing interim entry, otherwise append.
      const list = [...s.transcripts];
      if (list.length && list[list.length - 1].interim) list.pop();
      return { transcripts: [...list, t] };
    }),
  setTranscripts: (transcripts) => set({ transcripts }),
  setStar: (id, starred) =>
    set((s) => ({ transcripts: s.transcripts.map((t) => (t.id === id ? { ...t, starred } : t)) })),
  addResponse: (r) => set((s) => ({ latestResponse: r, aiHistory: [r, ...s.aiHistory] })),
  setCompression: (compression) => set({ compression }),
  clear: () =>
    set({
      currentSession: null,
      isRecording: false,
      transcripts: [],
      aiHistory: [],
      latestResponse: null,
      compression: null,
    }),
}));
