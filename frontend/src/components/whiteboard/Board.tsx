"use client";

import { Grid3x3, LayoutTemplate, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { Tldraw, type Editor } from "tldraw";
import "tldraw/tldraw.css";

import { getSocket } from "@/lib/socket";

const SNAPSHOT_INTERVAL_MS = 10_000;

/** tldraw board. Native pen/touch/mouse via pointer events; theme follows the app.
 *  While recording, exports a PNG every 10s and emits canvas_snapshot.
 *  Images/PDFs can be pasted or dragged straight onto the canvas (tldraw built-in). */
export function Board({ sessionId, recording }: { sessionId: string; recording: boolean }) {
  const editorRef = useRef<Editor | null>(null);
  const { resolvedTheme } = useTheme();
  const [grid, setGrid] = useState(false);

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

  function toggleGrid() {
    const editor = editorRef.current;
    if (!editor) return;
    const next = !editor.getInstanceState().isGridMode;
    editor.updateInstanceState({ isGridMode: next });
    setGrid(next);
  }

  function cornellTemplate() {
    const editor = editorRef.current;
    if (!editor) return;
    const b = editor.getViewportPageBounds();
    const pad = 40;
    const x = b.x + pad;
    const y = b.y + pad;
    const w = Math.min(b.w - pad * 2, 1000);
    const h = Math.min(b.h - pad * 2, 700);
    const cue = w * 0.3;
    const summaryH = h * 0.18;
    // Cue column | notes area, with a summary strip across the bottom.
    editor.createShapes([
      { type: "geo", x, y, props: { w: cue, h: h - summaryH, geo: "rectangle" } },
      { type: "geo", x: x + cue, y, props: { w: w - cue, h: h - summaryH, geo: "rectangle" } },
      { type: "geo", x, y: y + (h - summaryH), props: { w, h: summaryH, geo: "rectangle" } },
    ]);
  }

  function clearBoard() {
    const editor = editorRef.current;
    if (!editor) return;
    const ids = [...editor.getCurrentPageShapeIds()];
    if (ids.length && confirm("Clear everything on the board?")) editor.deleteShapes(ids);
  }

  return (
    <div className="absolute inset-0">
      <Tldraw
        onMount={(editor) => {
          editorRef.current = editor;
          applyTheme(editor);
          setGrid(editor.getInstanceState().isGridMode);
        }}
      />
      {/* Board superpowers toolbar */}
      <div className="pointer-events-auto absolute right-3 top-3 z-10 flex gap-1 rounded-xl border border-border bg-card/90 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={toggleGrid}
          aria-label="Graph paper grid"
          title="Graph paper grid"
          className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${grid ? "bg-primary/15 text-primary" : "hover:bg-muted"}`}
        >
          <Grid3x3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={cornellTemplate}
          aria-label="Cornell notes template"
          title="Cornell notes template"
          className="grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-muted"
        >
          <LayoutTemplate className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={clearBoard}
          aria-label="Clear board"
          title="Clear board"
          className="grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-muted hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
