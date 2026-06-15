"use client";

import { useEffect, useRef } from "react";

import { useSessionStore } from "@/store/sessionStore";

export function TranscriptPanel() {
  const transcripts = useSessionStore((s) => s.transcripts);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold">Transcript</div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {transcripts.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            Live transcript will appear here once recording starts.
          </p>
        ) : (
          transcripts.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl px-3 py-2 text-sm ${t.interim ? "text-muted-foreground" : "bg-muted text-foreground"}`}
            >
              {t.text}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
