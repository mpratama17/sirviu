"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// WAJIB di-set di module yang sama dengan pemakaian <Document>/<Page> —
// lihat react-pdf README "Import worker". pdfjs-dist di-hoist via
// pnpm-workspace.yaml publicHoistPattern supaya `new URL(...,
// import.meta.url)` ini resolve dengan benar di bawah pnpm 11+.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.2;

export function PdfViewer({ fileUrl }: { fileUrl: string }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/50 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Halaman sebelumnya"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-20 text-center text-sm tabular-nums text-muted-foreground">
            {pageNumber} / {numPages ?? "…"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Halaman berikutnya"
            disabled={!numPages || pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages ?? p, p + 1))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Perkecil"
            disabled={scale <= MIN_ZOOM}
            onClick={() => setScale((s) => Math.max(MIN_ZOOM, s - ZOOM_STEP))}
          >
            <ZoomOut className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-12 text-center text-sm tabular-nums text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Perbesar"
            disabled={scale >= MAX_ZOOM}
            onClick={() => setScale((s) => Math.min(MAX_ZOOM, s + ZOOM_STEP))}
          >
            <ZoomIn className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flex justify-center overflow-auto bg-muted p-4">
        {error ? (
          <p className="py-12 text-sm text-destructive">{error}</p>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              setPageNumber(1);
            }}
            onLoadError={() => setError("Gagal memuat PDF. Silakan download untuk melihat file.")}
            loading={<p className="py-12 text-sm text-muted-foreground">Memuat PDF...</p>}
          >
            <Page pageNumber={pageNumber} scale={scale} />
          </Document>
        )}
      </div>
    </div>
  );
}
