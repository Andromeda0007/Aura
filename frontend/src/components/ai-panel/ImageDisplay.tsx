"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ErrorNote } from "@/components/ai-panel/displays";
import type { ImageData } from "@/types";

export function ImageDisplay({ data }: { data: ImageData }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const url = data.imageUrl ?? "";

  // Preload to drive loading/error states; the image renders as a CSS background.
  useEffect(() => {
    if (!url) return;
    setLoaded(false);
    setFailed(false);
    const img = new window.Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => setLoaded(true);
    img.onerror = () => setFailed(true);
    img.src = url;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  // Apply the loaded image as a background imperatively (dynamic URL can't be a class).
  useEffect(() => {
    if (loaded && boxRef.current) boxRef.current.style.backgroundImage = `url("${url}")`;
  }, [loaded, url]);

  if (data.error) return <ErrorNote msg={data.error} />;

  // No URL (provider disabled / down) — show the prompt so nothing is lost.
  if (!url) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <p className="text-sm font-medium">Image unavailable</p>
        {data.note ? <p className="mt-0.5 text-xs text-muted-foreground">{data.note}</p> : null}
        {data.prompt ? <p className="mt-2 text-xs text-muted-foreground">{data.prompt}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {failed ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-muted/40 p-6 text-center text-muted-foreground">
          <ImageOff className="h-7 w-7" />
          <p className="text-xs">Couldn&apos;t load the image.</p>
        </div>
      ) : !loaded ? (
        <div className="aspect-[4/3] w-full animate-pulse rounded-xl border border-border bg-muted" />
      ) : (
        <div
          ref={boxRef}
          role="img"
          aria-label={data.prompt || "Generated image"}
          className="aspect-[4/3] w-full rounded-xl border border-border bg-muted/40 bg-contain bg-center bg-no-repeat"
        />
      )}
      {data.prompt ? <p className="text-xs text-muted-foreground">{data.prompt}</p> : null}
    </div>
  );
}
