"use client";

import { ArrowLeft, Copy, Download, FileText, Mic, PanelLeft, PanelLeftClose, Radio, Send, Users, X } from "lucide-react";
import { jsPDF } from "jspdf";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
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

const Board = dynamic(
  () => import("@/components/whiteboard/Board").then((m) => m.Board),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        Loading board…
      </div>
    ),
  },
);

// Minimal Web Speech typings for tap-to-talk (one-shot recognition).
type SpeechEvent = { results: { [i: number]: { [j: number]: { transcript: string } } } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function Workspace({ sessionId }: { sessionId: string }) {
  const ready = useRequireAuth();
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [command, setCommand] = useState("");
  const [tokens, setTokens] = useState(0);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [listening, setListening] = useState(false);
  const connectedOnce = useRef(false);
  const pttRef = useRef<Recognition | null>(null);

  const { currentSession, setSession, isRecording, setRecording, compression } = useSessionStore();
  const addTranscript = useSessionStore((s) => s.addTranscript);
  const addResponse = useSessionStore((s) => s.addResponse);
  const setCompression = useSessionStore((s) => s.setCompression);
  const setTranscripts = useSessionStore((s) => s.setTranscripts);
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

    // Restore prior transcripts + Aura responses.
    sessionApi
      .history(sessionId)
      .then((h) => {
        setTranscripts(h.transcripts.map((t) => ({ id: t.id, text: t.text, timestamp: t.timestamp })));
        h.commands.forEach((cmd) =>
          addResponse({
            type: cmd.type as AIResponse["type"],
            data: cmd.data,
            commandId: cmd.commandId,
            command: cmd.command,
          }),
        );
      })
      .catch(() => {});

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
    socket.on("context_update", (d: { tokens?: number }) => setTokens(d?.tokens ?? 0));
    socket.on("compression_started", () =>
      setCompression({ status: "started", message: "Compressing context…" }),
    );
    socket.on("compression_complete", (d: { segmentNum?: number }) => {
      setCompression({ status: "complete", segmentNum: d?.segmentNum });
      setTokens(0);
    });
    socket.on("error", (d: { message?: string }) => toast.error(d?.message ?? "Realtime error"));

    return () => {
      disconnectSocket();
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sessionId]);

  async function exportSession() {
    try {
      const blob = await sessionApi.exportMarkdown(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentSession?.subject ?? "session"}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  }

  async function exportPdf() {
    try {
      const blob = await sessionApi.exportMarkdown(sessionId);
      const text = await blob.text();
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(text, 500);
      doc.text(lines, 40, 50);
      doc.save(`${currentSession?.subject ?? "session"}.pdf`);
    } catch {
      toast.error("PDF export failed");
    }
  }

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
    getSocket()?.emit("voice_command", { sessionId, command: `hey aura ${text}` });
    setCommand("");
    toast.message("Sent to Aura", { description: text });
  }

  // Tap-to-talk: one-shot recognition → send as a command (no wake word needed).
  function pushToTalk() {
    if (listening) {
      pttRef.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Voice isn't supported here — type your command instead (Chrome/Edge for voice).");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results?.[0]?.[0]?.transcript?.trim();
      if (t) {
        getSocket()?.emit("voice_command", { sessionId, command: `hey aura ${t}` });
        toast.message("Sent to Aura", { description: t });
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    pttRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
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
          <Button
            variant="ghost"
            size="icon"
            aria-label={showTranscript ? "Hide transcript" : "Show transcript"}
            title={showTranscript ? "Hide transcript" : "Show transcript"}
            onClick={() => setShowTranscript((v) => !v)}
            className="hidden lg:inline-flex"
          >
            {showTranscript ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
          {(tokens > 0 || compression) && (
            <span className="hidden rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:inline">
              context · ~{tokens} tok
              {compression?.status === "started" ? " · compressing…" : ""}
            </span>
          )}
          <Button
            variant={isRecording ? "danger" : "outline"} size="sm"
            onClick={() => setRecording(!isRecording)}
          >
            <Radio className="h-4 w-4" /> {isRecording ? "Recording" : "Record"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowShare(true)}>
            <Users className="h-4 w-4" /> Invite students
          </Button>
          <Button variant="ghost" size="icon" aria-label="Export Markdown" title="Export Markdown" onClick={exportSession}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Export PDF" title="Export PDF" onClick={exportPdf}>
            <FileText className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={endSession}>End</Button>
        </div>
      </header>

      {/* 3-panel workspace */}
      <main
        className={`grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 ${
          showTranscript ? "lg:grid-cols-[20rem_1fr_22rem]" : "lg:grid-cols-[1fr_22rem]"
        }`}
      >
        {showTranscript && (
          <section className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:flex">
            <TranscriptPanel />
          </section>
        )}

        <section className="relative min-h-0 overflow-hidden rounded-2xl border border-border bg-card">
          <Board sessionId={sessionId} recording={isRecording} />
        </section>

        <section className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:flex">
          <AiPanel />
        </section>
      </main>

      {/* Footer command box */}
      <footer className="border-t border-border p-3">
        <form onSubmit={sendCommand} className="mx-auto flex max-w-3xl items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant={listening ? "danger" : "outline"}
            className={`h-12 w-12 shrink-0 ${listening ? "animate-pulse" : ""}`}
            aria-label={listening ? "Listening… tap to stop" : "Tap to talk"}
            title={listening ? "Listening… tap to stop" : "Tap to talk"}
            onClick={pushToTalk}
          >
            <Mic className="h-5 w-5" />
          </Button>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={listening ? "Listening…" : 'Type a command, or tap the mic / say "Hey Aura…"'}
            className="h-12 flex-1 rounded-full border border-input bg-card px-5 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="icon" className="h-12 w-12" aria-label="Send command">
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </footer>

      {showShare && currentSession?.join_code && (
        <ShareModal joinCode={currentSession.join_code} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}

function ShareModal({ joinCode, onClose }: { joinCode: string; onClose: () => void }) {
  const liveUrl =
    typeof window !== "undefined" ? `${window.location.origin}/live/${joinCode}` : "";

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Copied"),
      () => toast.error("Could not copy"),
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close"
          className="absolute right-3 top-3"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        <h2 className="font-display text-xl font-semibold tracking-tight">Invite students</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Students scan or enter the code to follow your board live.
        </p>

        <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-3">
          <QRCodeSVG value={liveUrl} size={160} />
        </div>

        <button
          type="button"
          onClick={() => copy(joinCode)}
          className="mx-auto mt-4 flex items-center gap-2 rounded-xl border border-border px-4 py-2 font-mono text-2xl font-semibold tracking-[0.2em] transition-colors hover:bg-muted"
        >
          {joinCode}
          <Copy className="h-4 w-4 text-muted-foreground" />
        </button>

        <button
          type="button"
          onClick={() => copy(liveUrl)}
          className="mt-3 w-full truncate rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/70"
          title={liveUrl}
        >
          {liveUrl}
        </button>
      </div>
    </div>
  );
}
