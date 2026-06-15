"use client";

import { ArrowLeft, Radio, Send, SquarePen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AudioCapture } from "@/components/audio/AudioCapture";
import { AiPanel } from "@/components/classroom/AiPanel";
import { TranscriptPanel } from "@/components/classroom/TranscriptPanel";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { sessionApi } from "@/lib/api";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/authStore";
import { useSessionStore } from "@/store/sessionStore";
import type { AIResponse } from "@/types";

export function Workspace({ sessionId }: { sessionId: string }) {
  const ready = useRequireAuth();
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [command, setCommand] = useState("");
  const connectedOnce = useRef(false);

  const { currentSession, setSession, isRecording, setRecording, compression } = useSessionStore();
  const addTranscript = useSessionStore((s) => s.addTranscript);
  const addResponse = useSessionStore((s) => s.addResponse);
  const setCompression = useSessionStore((s) => s.setCompression);
  const clear = useSessionStore((s) => s.clear);

  // Load session + connect socket once.
  useEffect(() => {
    if (!ready || connectedOnce.current) return;
    connectedOnce.current = true;

    sessionApi
      .get(sessionId)
      .then(setSession)
      .catch(() => {
        toast.error("Session not found");
        router.replace("/dashboard");
      });

    const token = useAuthStore.getState().tokens?.access_token;
    if (!token) return;
    const socket = connectSocket(sessionId, token);

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connected", () => setConnected(true));
    socket.on("transcript_update", (d: { id?: string; text: string; timestamp?: string }) =>
      addTranscript({
        id: d.id ?? crypto.randomUUID(),
        text: d.text,
        timestamp: d.timestamp ?? new Date().toISOString(),
      }),
    );
    socket.on("command_response", (d: AIResponse) => addResponse(d));
    socket.on("compression_started", () =>
      setCompression({ status: "started", message: "Compressing context…" }),
    );
    socket.on("compression_complete", (d: { segmentNum?: number }) =>
      setCompression({ status: "complete", segmentNum: d?.segmentNum }),
    );
    socket.on("error", (d: { message?: string }) => toast.error(d?.message ?? "Realtime error"));

    return () => {
      disconnectSocket();
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sessionId]);

  async function endSession() {
    try {
      await sessionApi.end(sessionId);
      toast.success("Session ended");
      router.push("/dashboard");
    } catch {
      toast.error("Could not end session");
    }
  }

  function sendCommand(e: React.FormEvent) {
    e.preventDefault();
    const text = command.trim();
    if (!text) return;
    const full = text.toLowerCase().startsWith("hey aura") ? text : `hey aura ${text}`;
    getSocket()?.emit("voice_command", { sessionId, command: full });
    setCommand("");
    toast.message("Command sent", { description: full });
  }

  if (!ready) return null;

  return (
    <div className="flex h-dvh flex-col">
      <AudioCapture sessionId={sessionId} enabled={isRecording} />
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="truncate font-semibold">{currentSession?.subject ?? "Session"}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-muted-foreground"}`} />
              {connected ? "Connected" : "Connecting…"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {compression && (
            <span className="hidden rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:inline">
              context · {compression.status === "started" ? "compressing…" : "compressed ✓"}
            </span>
          )}
          <Button
            variant={isRecording ? "danger" : "outline"} size="sm"
            onClick={() => setRecording(!isRecording)}
          >
            <Radio className="h-4 w-4" /> {isRecording ? "Recording" : "Record"}
          </Button>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={endSession}>End</Button>
        </div>
      </header>

      {/* 3-panel workspace */}
      <main className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-[20rem_1fr_22rem]">
        <section className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:flex">
          <TranscriptPanel />
        </section>

        <section className="grid min-h-0 place-items-center rounded-2xl border border-border bg-card">
          <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <SquarePen className="h-8 w-8" />
            <p className="font-medium text-foreground">Whiteboard</p>
            <p className="max-w-xs text-sm">The tldraw board (pen + touch) arrives in the next phase.</p>
          </div>
        </section>

        <section className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:flex">
          <AiPanel />
        </section>
      </main>

      {/* Footer command box */}
      <footer className="border-t border-border p-3">
        <form onSubmit={sendCommand} className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder='Type a command, or say "Hey Aura, make a quiz…"'
            className="h-12 flex-1 rounded-full border border-input bg-card px-5 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="icon" className="h-12 w-12" aria-label="Send command">
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </footer>
    </div>
  );
}
