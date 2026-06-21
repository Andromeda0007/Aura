"use client";

import "@excalidraw/excalidraw/index.css";

import {
  Excalidraw,
  convertToExcalidrawElements,
  exportToBlob,
  getDataURL,
  getVisibleSceneBounds,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import { Grid3x3, LayoutTemplate, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import { BOARD_DND_MIME, type BoardDragPayload } from "@/lib/board-content";
import { getSocket } from "@/lib/socket";

// Self-host Excalidraw's fonts/assets from /public (copied in the build step) so the
// board never depends on an external CDN at runtime.
if (typeof window !== "undefined") {
  (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = "/";
}

const SNAPSHOT_INTERVAL_MS = 10_000;
const MAX_DROP_DIM = 360; // cap the size of dropped images on the board
const IMAGE_MIMES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/gif", "image/bmp"];

// Types derived from the runtime API so we avoid fragile deep type-imports.
type ExcalidrawAPI = Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>["excalidrawAPI"]>>[0];
type FileData = Parameters<ExcalidrawAPI["addFiles"]>[0][number];
type Skeleton = NonNullable<Parameters<typeof convertToExcalidrawElements>[0]>[number];
type InitialData = React.ComponentProps<typeof Excalidraw>["initialData"];
type ChangeHandler = NonNullable<React.ComponentProps<typeof Excalidraw>["onChange"]>;

const normalizeMime = (m: string) => (IMAGE_MIMES.includes(m) ? m : "image/png");

// --- persistence: keep the board across refreshes, per session (localStorage) ---
const boardKey = (sid: string) => `aura-board-${sid}`;

function loadBoard(sid: string): InitialData {
  try {
    const raw = localStorage.getItem(boardKey(sid));
    if (!raw) return undefined;
    const { elements, files } = JSON.parse(raw);
    return { elements: elements ?? [], files: files ?? {} } as InitialData;
  } catch {
    return undefined;
  }
}

function saveBoard(sid: string, data: string) {
  try {
    localStorage.setItem(boardKey(sid), data);
  } catch {
    /* quota exceeded (large images) — skip this save, keep the last good one */
  }
}

function scaled(w: number, h: number, max = MAX_DROP_DIM) {
  const s = Math.min(1, max / Math.max(w || max, h || max));
  return { width: Math.round((w || max) * s), height: Math.round((h || max) * s) };
}

function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 300, height: img.naturalHeight || 200 });
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

// Excalidraw renders SVG images natively, so we embed the SVG markup as an
// image/svg+xml data URL (no canvas rasterization — drawing a Mermaid SVG with
// <foreignObject> to a canvas taints it and toDataURL throws).
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/** Excalidraw board. Native pen/touch/mouse; theme follows the app. While recording,
 *  exports a PNG every 10s and emits canvas_snapshot. Aura cards (image/svg/text) can be
 *  dragged from the AI panel straight onto the canvas. */
export function Board({ sessionId, recording }: { sessionId: string; recording: boolean }) {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [grid, setGrid] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  // Restore the board for this session (survives refresh).
  const [initialData] = useState<InitialData>(() => loadBoard(sessionId));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced persist on every edit (drawing, drops, clears all flow through here).
  const handleChange: ChangeHandler = (elements, _appState, files) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveBoard(sessionId, JSON.stringify({ elements, files }));
    }, 600);
  };
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  // Snapshot loop: every 10s while recording, export the board to PNG and emit it.
  useEffect(() => {
    if (!recording) return;
    const tick = async () => {
      const api = apiRef.current;
      if (!api) return;
      const elements = api.getSceneElements();
      if (elements.length === 0) return; // nothing drawn yet
      try {
        const blob = await exportToBlob({
          elements,
          appState: { ...api.getAppState(), exportBackground: true },
          files: api.getFiles(),
          mimeType: "image/png",
          exportPadding: 16,
        });
        const url = await getDataURL(blob);
        getSocket()?.emit("canvas_snapshot", { sessionId, imageData: url, pageNumber: 1 });
      } catch {
        /* export can fail mid-edit; next tick retries */
      }
    };
    const id = setInterval(tick, SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [recording, sessionId]);

  // Merge new elements into the scene. updateScene REPLACES the scene, so we must
  // spread the existing elements in — otherwise every add wipes the board.
  function addSkeletons(skeletons: Skeleton[]) {
    const api = apiRef.current;
    if (!api) return;
    const next = convertToExcalidrawElements(skeletons);
    api.updateScene({ elements: [...api.getSceneElements(), ...next] });
  }

  async function addImageDataUrl(dataURL: string, mimeType: string, at: { x: number; y: number }) {
    const api = apiRef.current;
    if (!api) return;
    const { width, height } = await loadImageSize(dataURL).catch(() => ({ width: 400, height: 300 }));
    const dims = scaled(width, height);
    const fileId = crypto.randomUUID();
    // Register the file FIRST so the image element resolves against the cache, then add
    // the element marked "saved" (file is available) so Excalidraw renders it immediately.
    api.addFiles([{ id: fileId, dataURL, mimeType: normalizeMime(mimeType), created: Date.now() } as FileData]);
    const els = convertToExcalidrawElements([
      { type: "image", fileId, x: at.x, y: at.y, ...dims, status: "saved" } as Skeleton,
    ]);
    api.updateScene({ elements: [...api.getSceneElements(), ...els] });
  }

  function addText(text: string, at: { x: number; y: number }) {
    addSkeletons([{ type: "text", x: at.x, y: at.y, text, fontSize: 20 } as Skeleton]);
  }

  // Accept Aura cards dragged from the AI panel. Native capture-phase listeners run
  // before Excalidraw's own drop handling, so we fully own these drops.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isOurs = (dt: DataTransfer | null) => !!dt && Array.from(dt.types).includes(BOARD_DND_MIME);

    const onDragOver = (e: DragEvent) => {
      if (!isOurs(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setDropActive(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!isOurs(e.dataTransfer)) return;
      if (e.relatedTarget && el.contains(e.relatedTarget as Node)) return; // still inside
      setDropActive(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!isOurs(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      setDropActive(false);
      const api = apiRef.current;
      if (!api || !e.dataTransfer) return;
      let payload: BoardDragPayload;
      try {
        payload = JSON.parse(e.dataTransfer.getData(BOARD_DND_MIME)) as BoardDragPayload;
      } catch {
        return;
      }
      const at = viewportCoordsToSceneCoords({ clientX: e.clientX, clientY: e.clientY }, api.getAppState());

      if (payload.kind === "image" && payload.imageUrl) {
        const src = payload.imageUrl;
        void (async () => {
          try {
            const res = await fetch(src, { mode: "cors" });
            const blob = await res.blob();
            const dataURL = await getDataURL(blob);
            await addImageDataUrl(dataURL, blob.type || "image/png", at);
          } catch {
            addText(src, at); // CORS-blocked: drop the link as text instead
          }
        })();
      } else if (payload.kind === "svg" && payload.svg) {
        void addImageDataUrl(svgToDataUrl(payload.svg), "image/svg+xml", at);
      } else if (payload.text) {
        addText(payload.text, at);
      }
    };

    el.addEventListener("dragover", onDragOver, true);
    el.addEventListener("dragleave", onDragLeave, true);
    el.addEventListener("drop", onDrop, true);
    return () => {
      el.removeEventListener("dragover", onDragOver, true);
      el.removeEventListener("dragleave", onDragLeave, true);
      el.removeEventListener("drop", onDrop, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleGrid() {
    const api = apiRef.current;
    if (!api) return;
    const next = !api.getAppState().gridModeEnabled;
    api.updateScene({ appState: { gridModeEnabled: next } });
    setGrid(next);
  }

  function cornellTemplate() {
    const api = apiRef.current;
    if (!api) return;
    const [minX, minY, maxX, maxY] = getVisibleSceneBounds(api.getAppState());
    const pad = 40;
    const x = minX + pad;
    const y = minY + pad;
    const w = Math.min(maxX - minX - pad * 2, 1000);
    const h = Math.min(maxY - minY - pad * 2, 700);
    const cue = w * 0.3;
    const summaryH = h * 0.18;
    // Cue column | notes area, with a summary strip across the bottom.
    addSkeletons([
      { type: "rectangle", x, y, width: cue, height: h - summaryH },
      { type: "rectangle", x: x + cue, y, width: w - cue, height: h - summaryH },
      { type: "rectangle", x, y: y + (h - summaryH), width: w, height: summaryH },
    ] as Skeleton[]);
  }

  function clearBoard() {
    const api = apiRef.current;
    if (!api) return;
    if (api.getSceneElements().length && confirm("Clear everything on the board?")) {
      api.updateScene({ elements: [] });
    }
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api;
          setGrid(api.getAppState().gridModeEnabled);
        }}
        initialData={initialData}
        onChange={handleChange}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
      />
      {/* Drop highlight while an Aura card is dragged over the board */}
      {dropActive && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center rounded-2xl bg-primary/5 ring-2 ring-inset ring-primary/60">
          <span className="mt-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow">
            Drop to add to the board
          </span>
        </div>
      )}
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
