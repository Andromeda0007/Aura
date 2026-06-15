"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { Tldraw, type Editor } from "tldraw";
import "tldraw/tldraw.css";

import { getSocket } from "@/lib/socket";

const SNAPSHOT_INTERVAL_MS = 10_000;

/** tldraw board. Native pen/touch/mouse via pointer events; theme follows the app.
 *  While recording, exports a PNG every 10s and emits canvas_snapshot. */
export function Board({ sessionId, recording }: { sessionId: string; recording: boolean }) {
  const editorRef = useRef<Editor | null>(null);
  const { resolvedTheme } = useTheme();

  function applyTheme(editor: Editor | null) {
    editor?.user.updateUserPreferences({
      colorScheme: resolvedTheme === "dark" ? "dark" : "light",
    });
  }

  useEffect(() => {
    applyTheme(editorRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);

  useEffect(() => {
    if (!recording) return;
    const tick = async () => {
      const editor = editorRef.current;
      if (!editor) return;
      const ids = [...editor.getCurrentPageShapeIds()];
      if (ids.length === 0) return; // nothing drawn yet
      try {
        const { url } = await editor.toImageDataUrl(ids, { format: "png", background: true });
        getSocket()?.emit("canvas_snapshot", { sessionId, imageData: url, pageNumber: 1 });
      } catch {
        /* export can fail mid-edit; next tick retries */
      }
    };
    const id = setInterval(tick, SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [recording, sessionId]);

  return (
    <div className="absolute inset-0">
      <Tldraw
        onMount={(editor) => {
          editorRef.current = editor;
          applyTheme(editor);
        }}
      />
    </div>
  );
}
