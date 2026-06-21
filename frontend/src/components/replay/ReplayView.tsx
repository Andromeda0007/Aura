"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ResponseView } from "@/components/ai-panel/ResponseView";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { sessionApi } from "@/lib/api";
import type { AIResponse } from "@/types";

type Event =
  | { kind: "speech"; t: number; text: string }
  | { kind: "aura"; t: number; response: AIResponse };

export function ReplayView({ sessionId }: { sessionId: string }) {
  const ready = useRequireAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [subject, setSubject] = useState("");
  const [cursor, setCursor] = useState(0); // index of next event to reveal
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ready) return;
    sessionApi.get(sessionId).then((s) => setSubject(s.subject)).catch(() => {});
    sessionApi
      .history(sessionId)
      .then((h) => {
        const evs: Event[] = [];
        h.transcripts.forEach((t) =>
          evs.push({ kind: "speech", t: +new Date(t.timestamp), text: t.text }),
        );
        h.commands.forEach((c) =>
          evs.push({
            kind: "aura",
            // history commands carry a timestamp; fall back to 0 if absent
            t: +new Date((c as { timestamp?: string }).timestamp ?? 0),
            response: {
              type: c.type as AIResponse["type"],
              data: c.data,
              commandId: c.commandId,
              command: c.command,
            },
          }),
        );
        evs.sort((a, b) => a.t - b.t);
        setEvents(evs);
      })
      .catch(() => toast.error("Could not load replay"));
  }, [ready, sessionId]);

  // Auto-advance one event per tick while playing.
  useEffect(() => {
    if (!playing) return;
    if (cursor >= events.length) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setCursor((c) => c + 1), 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, cursor, events.length]);

  const revealed = useMemo(() => events.slice(0, cursor), [events, cursor]);
  const transcript = revealed.filter((e): e is Extract<Event, { kind: "speech" }> => e.kind === "speech");
  const auraEvents = revealed.filter((e): e is Extract<Event, { kind: "aura" }> => e.kind === "aura");
  const progress = events.length ? Math.round((cursor / events.length) * 100) : 0;

  if (!ready) return null;

  return (
    <div className="relative flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <p className="font-semibold">Replay · {subject}</p>
            <p className="text-xs text-muted-foreground">
              {cursor} / {events.length} moments
            </p>
          </div>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <p className="border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Transcript
          </p>
          <div className="flex-1 space-y-2 overflow-y-auto p-4 text-sm">
            {transcript.length === 0 ? (
              <p className="text-muted-foreground">Press play to replay the class.</p>
            ) : (
              transcript.map((e, i) => <p key={i}>{e.text}</p>)
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <p className="border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Aura moments
          </p>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {auraEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Generated content will appear in sync.</p>
            ) : (
              auraEvents.map((e, i) => <ResponseView key={i} response={e.response} />)
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-border p-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Button
            size="icon"
            onClick={() => {
              if (cursor >= events.length) setCursor(0);
              setPlaying((p) => !p);
            }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Restart"
            onClick={() => {
              setPlaying(false);
              setCursor(0);
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <input
            type="range"
            min={0}
            max={events.length}
            value={cursor}
            onChange={(e) => {
              setPlaying(false);
              setCursor(Number(e.target.value));
            }}
            className="flex-1 accent-[var(--primary)]"
            aria-label="Scrub timeline"
          />
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{progress}%</span>
        </div>
      </footer>
    </div>
  );
}
