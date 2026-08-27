"use client";

import dynamic from "next/dynamic";

// react-pdf butuh window/DOM (pdf.js worker) — SSR harus di-skip. Ini WAJIB
// dipanggil dari Client Component; `ssr: false` error kalau dipanggil
// langsung dari Server Component (lihat next/dist/docs lazy-loading.md).
const PdfViewer = dynamic(
  () => import("@/components/documents/pdf-viewer").then((mod) => mod.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
        Memuat pratinjau...
      </div>
    ),
  },
);

export function PdfViewerLoader({ fileUrl }: { fileUrl: string }) {
  return <PdfViewer fileUrl={fileUrl} />;
}
