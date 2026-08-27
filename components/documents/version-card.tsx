import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word (.docx)",
};

export function VersionCard({
  documentId,
  versionNumber,
  isLatest,
  fileName,
  fileSize,
  mimeType,
  uploadedByName,
  uploadedAt,
  uploadNotes,
}: {
  documentId: string;
  versionNumber: number;
  isLatest: boolean;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedByName: string;
  uploadedAt: string;
  uploadNotes: string | null;
}) {
  const isDocx = mimeType !== "application/pdf";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 size-8 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              Versi {versionNumber}
              {isLatest ? " (terbaru)" : ""}
            </p>
            <p className="truncate text-sm text-muted-foreground">{fileName}</p>
            <p className="text-xs text-text-muted">
              {MIME_LABELS[mimeType] ?? mimeType} · {formatFileSize(fileSize)} · diupload{" "}
              {uploadedByName} pada{" "}
              {new Date(uploadedAt).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={
            <a
              href={`/documents/${documentId}/download?v=${versionNumber}`}
            />
          }
        >
          <Download className="size-4" aria-hidden="true" />
          Download
        </Button>
      </div>

      {isDocx ? (
        <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
          File .docx tidak bisa dipratinjau. Silakan download.
        </p>
      ) : null}

      {uploadNotes ? (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          {uploadNotes}
        </p>
      ) : null}
    </div>
  );
}
