"use client";

import { ChevronRight, GripVertical, History, Sparkles, Volume2 } from "lucide-react";
import { useState } from "react";

import { ResponseView } from "@/components/ai-panel/ResponseView";
import { BOARD_DND_MIME, responseToBoardText, type BoardDragPayload } from "@/lib/board-content";
import { getSocket } from "@/lib/socket";
import { speak, speakableText } from "@/lib/tts";
import { useSessionStore } from "@/store/sessionStore";
import type { AIResponse, ChemistryData, ImageData } from "@/types";

export function AiPanel() {
  const latest = useSessionStore((s) => s.latestResponse);
  const history = useSessionStore((s) => s.aiHistory);
  const sessionId = useSessionStore((s) => s.currentSession?.id);

  // History lives inside this panel — no separate page.
  const [showHistory, setShowHistory] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  function regenerate(command?: string) {
    if (!command) return;
    getSocket()?.emit("voice_command", { sessionId, command: `hey aura ${command}` });
  }

  // Drag an Aura card onto the whiteboard; the board's drop handler reads this.
  function handleDragStart(e: React.DragEvent, r: AIResponse) {
    let payload: BoardDragPayload | null = null;

    // Diagrams drop as an image: grab the rendered mermaid SVG from the card.
    // ":not(.lucide)" skips the grip/read-aloud icons; scoped to the body so we
    // never pick a header icon. Falls back to text (the title) if not rendered.
    if (r.type === "diagram") {
      const svgEl = e.currentTarget.querySelector<SVGSVGElement>("[data-aura-body] svg:not(.lucide)");
      if (svgEl) {
        const clone = svgEl.cloneNode(true) as SVGSVGElement;
        const rect = svgEl.getBoundingClientRect();
        clone.setAttribute("width", String(Math.round(rect.width) || 640));
        clone.setAttribute("height", String(Math.round(rect.height) || 420));
        clone.removeAttribute("style"); // drop max-width:100% so it rasterizes at full size
        payload = { kind: "svg", svg: new XMLSerializer().serializeToString(clone) };
      }
    } else if (r.type === "image") {
      const url = (r.data as ImageData).imageUrl;
      if (url) payload = { kind: "image", imageUrl: url };
    } else if (r.type === "chemistry") {
      const url = (r.data as ChemistryData).imageUrl;
      if (url) {
        payload = { kind: "image", imageUrl: url };
      } else {
        // smiles-drawer renders to a <canvas> — export it as a data URL image.
        const canvas = e.currentTarget.querySelector<HTMLCanvasElement>("[data-aura-body] canvas");
        if (canvas) {
          try {
            payload = { kind: "image", imageUrl: canvas.toDataURL("image/png") };
          } catch {
            /* tainted canvas — fall through to text */
          }
        }
      }
    }

    if (!payload) payload = { kind: "text", text: responseToBoardText(r) };

    // Custom MIME only — so tldraw's native text-drop doesn't also fire (no dupes).
    e.dataTransfer.setData(BOARD_DND_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  }

  // Oldest-first so the list reads 1, 2, 3, … in the order things were asked.
  const asks = [...history].reverse();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" /> {showHistory ? "History" : "Aura"}
        </span>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-label={showHistory ? "Back to Aura" : "Session history"}
          title={showHistory ? "Back to Aura" : "Session history"}
          className={`rounded-full p-1.5 transition-colors ${
            showHistory ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {showHistory ? (
          asks.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <History className="h-7 w-7" />
              <p className="max-w-56 text-sm">
                Nothing asked yet. Everything you ask Aura this session shows up here.
              </p>
            </div>
          ) : (
            <ol className="space-y-2">
              {asks.map((r, idx) => {
                const id = r.commandId ?? String(idx);
                const open = openId === id;
                const ask = r.command?.trim();
                return (
                  <li key={id} className="overflow-hidden rounded-xl border border-border bg-muted/30">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground/10 text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {ask ? `“Hey Aura, ${ask}”` : "Aura response"}
                        </span>
                        <span className="text-xs capitalize text-muted-foreground">{r.type}</span>
                      </span>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                      />
                    </button>
                    {open && (
                      <div className="border-t border-border bg-card p-3">
                        <div className="mb-2 flex justify-end">
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
                        <ResponseView response={r} onRegenerate={() => regenerate(r.command)} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )
        ) : !latest ? (
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
                draggable
                onDragStart={(e) => handleDragStart(e, r)}
                title="Drag onto the board"
                className={`group cursor-grab rounded-xl border border-border bg-muted/40 p-3 active:cursor-grabbing ${i === 0 ? "animate-rise" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground/10 text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {history.length - i}
                    </span>
                    <span className="inline-block rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                      {r.type}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-50" aria-hidden />
                    <button
                      type="button"
                      onClick={() => speak(speakableText(r))}
                      aria-label="Read aloud"
                      title="Read aloud"
                      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </span>
                </div>
                <div className="mt-2" data-aura-body>
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
