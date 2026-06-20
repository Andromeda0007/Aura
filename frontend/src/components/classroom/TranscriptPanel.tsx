"use client";

import { Search, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { sessionApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/sessionStore";

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-amber-300/60 px-0.5 text-foreground">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function TranscriptPanel() {
  const transcripts = useSessionStore((s) => s.transcripts);
  const setStar = useSessionStore((s) => s.setStar);
  const sessionId = useSessionStore((s) => s.currentSession?.id);
  const [q, setQ] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let list = transcripts;
    if (starredOnly) list = list.filter((t) => t.starred);
    if (q.trim()) list = list.filter((t) => t.text.toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [transcripts, q, starredOnly]);

  useEffect(() => {
    if (!q && !starredOnly) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts.length, q, starredOnly]);

  async function toggleStar(id: string, next: boolean) {
    if (!sessionId) return;
    setStar(id, next); // optimistic
    try {
      await sessionApi.starTranscript(sessionId, id, next);
    } catch {
      setStar(id, !next);
      toast.error("Could not save star");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search transcript…"
            className="h-8 w-full rounded-lg border border-input bg-card pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button
          type="button"
          aria-label="Show starred only"
          title="Starred only"
          onClick={() => setStarredOnly((v) => !v)}
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors",
            starredOnly ? "border-amber-400 bg-amber-400/10 text-amber-500" : "border-input hover:bg-muted",
          )}
        >
          <Star className={cn("h-4 w-4", starredOnly && "fill-current")} />
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            {transcripts.length === 0
              ? "Live transcript will appear here once recording starts."
              : "No lines match."}
          </p>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
                t.interim ? "text-muted-foreground" : "bg-muted text-foreground",
              )}
            >
              <span className="min-w-0 flex-1">{highlight(t.text, q)}</span>
              {!t.interim && (
                <button
                  type="button"
                  aria-label={t.starred ? "Unstar" : "Star this moment"}
                  onClick={() => toggleStar(t.id, !t.starred)}
                  className={cn(
                    "shrink-0 transition-opacity",
                    t.starred ? "text-amber-500" : "text-muted-foreground opacity-0 group-hover:opacity-100",
                  )}
                >
                  <Star className={cn("h-4 w-4", t.starred && "fill-current")} />
                </button>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
