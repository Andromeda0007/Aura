"use client";

import { useEffect, useRef, useState } from "react";

import { ErrorNote } from "@/components/ai-panel/displays";
import { ImageDisplay } from "@/components/ai-panel/ImageDisplay";
import { pickChemistrySource } from "@/lib/response-checks";
import type { ChemistryData } from "@/types";

export function ChemistryDisplay({ data }: { data: ChemistryData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const src = pickChemistrySource(data);

  // Render a SMILES string client-side (only when there's no PubChem image).
  useEffect(() => {
    if (src.mode !== "smiles" || !src.smiles || !canvasRef.current) return;
    let active = true;
    setFailed(false);
    (async () => {
      try {
        // Import the prebuilt UMD bundle: the package "main" is unbuilt source
        // whose ./CIP (.ts) import breaks the Next bundler.
        const mod = await import("smiles-drawer/dist/smiles-drawer.min.js");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lib: any = (mod as { default?: unknown }).default ?? mod;
        const drawer = new lib.Drawer({ width: 320, height: 240, padding: 12 });
        lib.parse(
          src.smiles,
          (tree: unknown) => {
            if (active && canvasRef.current) drawer.draw(tree, canvasRef.current, "light", false);
          },
          () => {
            if (active) setFailed(true);
          },
        );
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [src.mode, src.smiles]);

  if (data.error) return <ErrorNote msg={data.error} />;

  return (
    <div className="space-y-2">
      {data.name ? <p className="text-sm font-medium text-foreground">{data.name}</p> : null}

      {src.mode === "image" ? (
        <ImageDisplay data={{ imageUrl: src.imageUrl }} />
      ) : src.mode === "smiles" && !failed ? (
        <div className="overflow-hidden rounded-xl border border-border bg-white p-2">
          <canvas ref={canvasRef} className="mx-auto" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-sm font-medium">Structure unavailable</p>
          {data.note ? <p className="mt-0.5 text-xs text-muted-foreground">{data.note}</p> : null}
          {data.smiles ? (
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{data.smiles}</p>
          ) : null}
        </div>
      )}

      {data.caption ? <p className="text-xs text-muted-foreground">{data.caption}</p> : null}
    </div>
  );
}
