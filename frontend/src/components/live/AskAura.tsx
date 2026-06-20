"use client";

import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { liveApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Turn {
  q: string;
  a: string | null;
}

/** Floating "Ask Aura" tutor for students on the live page. */
export function AskAura({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (!question || busy) return;
    setQ("");
    setBusy(true);
    setTurns((t) => [...t, { q: question, a: null }]);
    try {
      const { answer } = await liveApi.ask(code, question);
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, a: answer } : turn)));
    } catch {
      setTurns((t) =>
        t.map((turn, i) => (i === t.length - 1 ? { ...turn, a: "Couldn't reach Aura — try again." } : turn)),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
        aria-label="Ask Aura"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Ask Aura</span>
            <span className="ml-auto text-xs text-muted-foreground">about this class</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {turns.length === 0 && (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                Stuck on something? Ask a question about what your teacher just covered.
              </p>
            )}
            {turns.map((t, i) => (
              <div key={i} className="space-y-2">
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {t.q}
                </p>
                <p
                  className={cn(
                    "w-fit max-w-[90%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm",
                    t.a === null && "animate-pulse text-muted-foreground",
                  )}
                >
                  {t.a ?? "Thinking…"}
                </p>
              </div>
            ))}
          </div>

          <form onSubmit={ask} className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type your question…"
              className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={busy || !q.trim()}
              aria-label="Send"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
