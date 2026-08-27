"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { ALLOWED_MIME_TYPES, validateUploadFile } from "@/lib/validators/documents";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropzone({
  file,
  onChange,
  error,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFile = useCallback(
    (candidate: File | undefined | null) => {
      if (!candidate) return;
      const result = validateUploadFile(candidate);
      if (!result.valid) {
        setLocalError(result.error);
        onChange(null);
        return;
      }
      setLocalError(null);
      onChange(candidate);
    },
    [onChange],
  );

  const displayError = error ?? localError;

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
        <FileText className="size-8 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
          <p className="text-xs text-text-muted">{formatFileSize(file.size)}</p>
        </div>
        <button
          type="button"
          aria-label="Hapus file"
          onClick={() => {
            onChange(null);
            setLocalError(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border bg-card px-4 py-10 text-center transition-colors hover:bg-secondary",
          isDragging && "border-primary bg-secondary",
          displayError && "border-destructive",
        )}
      >
        <Upload className="size-8 text-text-muted" aria-hidden="true" />
        <p className="text-sm text-foreground">
          Tarik file ke sini, atau{" "}
          <span className="font-medium text-primary">pilih file</span>
        </p>
        <p className="text-xs text-text-muted">
          Format: PDF atau Word (.docx). Maksimal 10 MB.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(",")}
          className="sr-only"
          aria-label="Upload file dokumen"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>
      {displayError ? (
        <p role="alert" className="mt-1.5 text-sm text-destructive">
          {displayError}
        </p>
      ) : null}
    </div>
  );
}
