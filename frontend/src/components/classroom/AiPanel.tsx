"use client";

import { Sparkles, Volume2 } from "lucide-react";

import { ResponseView } from "@/components/ai-panel/ResponseView";
import { getSocket } from "@/lib/socket";
import { speak, speakableText } from "@/lib/tts";
import { useSessionStore } from "@/store/sessionStore";

export function AiPanel() {
  const latest = useSessionStore((s) => s.latestResponse);
  const history = useSessionStore((s) => s.aiHistory);
  const sessionId = useSessionStore((s) => s.currentSession?.id);

  function regenerate(command?: string) {
    if (!command) return;
    getSocket()?.emit("voice_command", { sessionId, command: `hey aura ${command}` });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-accent" /> Aura
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!latest ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Sparkles className="h-7 w-7 text-accent" />
            <p className="max-w-56 text-sm">
              Say <span className="font-medium text-foreground">“Hey Aura”</span> or type a command to
              generate a quiz, summary, explanation, and more.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((r, i) => (
              <div
                key={r.commandId ?? i}
                className={`rounded-xl border border-border bg-muted/40 p-3 ${i === 0 ? "animate-rise" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-block rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                    {r.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => speak(speakableText(r))}
                    aria-label="Read aloud"
                    title="Read aloud"
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2">
                  <ResponseView response={r} onRegenerate={() => regenerate(r.command)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
