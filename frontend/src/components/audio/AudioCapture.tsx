"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { getSocket } from "@/lib/socket";
import { useSessionStore } from "@/store/sessionStore";

// Minimal typings for the Web Speech API (not in lib.dom for all targets).
interface SpeechRecognitionResult {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

// Robust wake matcher: browser ASR mangles "Aura" (ora / aurora / era / "or a" …),
// so we accept a "hey/ok/okay/hi" anchor + an Aura-ish word. The anchor keeps
// false-positives low while tolerating the common mis-hearings.
const WAKE_RE =
  /\b(?:hey|hay|hi|ok|okay)[\s,]+(?:aura|aurora|ora|oora|hora|era|aro|arrow|or a|are a|hour a)\b/i;

/** Browser Web Speech capture. Detects the "Hey Aura" wake phrase -> voice_command;
 *  otherwise streams finalized text as transcript_text. Renders nothing. */
export function AudioCapture({ sessionId, enabled }: { sessionId: string; enabled: boolean }) {
  const addTranscript = useSessionStore((s) => s.addTranscript);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const enabledRef = useRef(enabled);
  const warnedRef = useRef(false);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) {
      recRef.current?.stop();
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      if (!warnedRef.current) {
        warnedRef.current = true;
        toast.error("Voice capture isn't supported in this browser — use the typed command box. (Chrome/Edge recommended.)");
      }
      return;
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0].transcript;
        if (res.isFinal) handleFinal(text);
        else interim += text;
      }
      if (interim.trim()) {
        addTranscript({
          id: "interim",
          text: interim.trim(),
          interim: true,
          timestamp: new Date().toISOString(),
        });
      }
    };

    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        // transient; auto-restart handles recovery
      }
    };

    rec.onend = () => {
      if (enabledRef.current) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };

    function handleFinal(raw: string) {
      const text = raw.trim();
      if (!text) return;
      const socket = getSocket();
      const m = text.match(WAKE_RE);
      if (m && m.index !== undefined) {
        const command = text.slice(m.index + m[0].length).replace(/^[\s,.:;!?–-]+/, "").trim();
        if (command) socket?.emit("voice_command", { sessionId, command: `hey aura ${command}` });
        return;
      }
      socket?.emit("transcript_text", { sessionId, text });
    }

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* noop */
    }

    return () => {
      enabledRef.current = false;
      rec.onend = null;
      rec.stop();
    };
  }, [enabled, sessionId, addTranscript]);

  return null;
}
