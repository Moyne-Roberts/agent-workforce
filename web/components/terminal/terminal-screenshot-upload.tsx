"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createUploadUrl } from "@/lib/systems/actions";
import { toast } from "sonner";

interface FileEntry {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  path: string;
  error?: string;
}

interface TerminalScreenshotUploadProps {
  runId: string;
  taskId: string;
  onUploadComplete: (paths: string[]) => void;
  disabled: boolean;
}

/**
 * Client-side resize: scale image to max 1568px longest side.
 * This matches Claude's internal resolution limit and saves bandwidth.
 */
async function resizeImage(file: File, maxSize: number = 1568): Promise<Blob> {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
  });

  const { width, height } = img;
  URL.revokeObjectURL(img.src);

  if (width <= maxSize && height <= maxSize) return file;

  const scale = maxSize / Math.max(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), file.type)
  );
}

/**
 * Screenshot upload dropzone with thumbnail grid, client-side resize,
 * and signed URL upload to Supabase Storage.
 *
 * Bypasses Vercel 4.5MB serverless limit by uploading directly from
 * the browser to Supabase Storage via signed upload URLs.
 */
export function TerminalScreenshotUpload({
  runId,
  taskId,
  onUploadComplete,
  disabled,
}: TerminalScreenshotUploadProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback((newFiles: File[]) => {
    const imageFiles = newFiles.filter(
      (f) => f.type === "image/png" || f.type === "image/jpeg"
    );
    const entries: FileEntry[] = imageFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
      path: "",
    }));
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const entry = prev[index];
      if (entry?.preview) {
        URL.revokeObjectURL(entry.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(Array.from(e.target.files));
        // Reset input so the same file can be re-selected
        e.target.value = "";
      }
    },
    [addFiles]
  );

  const handleSubmit = async () => {
    if (files.length === 0 || submitting) return;
    setSubmitting(true);

    const uploadedPaths: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      if (entry.uploaded) {
        uploadedPaths.push(entry.path);
        continue;
      }

      // Mark as uploading
      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, uploading: true, error: undefined } : f))
      );

      try {
        // Resize before upload
        const resized = await resizeImage(entry.file);

        // Get signed URL from server action
        const storagePath = `${runId}/${taskId}/screenshots/${entry.file.name}`;
        const result = await createUploadUrl("automation-assets", storagePath);

        if ("error" in result) {
          throw new Error(result.error);
        }

        // Upload directly to Supabase Storage via signed URL
        const uploadResponse = await fetch(result.signedUrl, {
          method: "PUT",
          body: resized,
          headers: {
            "Content-Type": entry.file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        uploadedPaths.push(storagePath);
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, uploading: false, uploaded: true, path: storagePath } : f
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        toast.error(`Failed to upload ${entry.file.name}: ${message}`);
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, uploading: false, error: message } : f
          )
        );
      }
    }

    if (uploadedPaths.length > 0) {
      onUploadComplete(uploadedPaths);
    }
    setSubmitting(false);
  };

  const allUploaded = files.length > 0 && files.every((f) => f.uploaded);
  const someUploading = files.some((f) => f.uploading);

  return (
    <div className="mt-3 space-y-3">
      {/* Instruction text */}
      <p className="text-sm text-muted-foreground">
        Upload screenshots of each screen mentioned in the SOP. PNG or JPG, any
        number of files.
      </p>

      {/* Dropzone */}
      <div
        className={`flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Drop screenshots here or click to browse"
      >
        <ImagePlus className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drop screenshots here or click to browse
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
      </div>

      {/* Thumbnail grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map((entry, i) => (
            <div key={`${entry.file.name}-${i}`} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.preview}
                alt={entry.file.name}
                className={`h-20 w-full rounded object-cover ${
                  entry.error ? "border-2 border-destructive" : ""
                } ${entry.uploaded ? "opacity-80" : ""}`}
              />

              {/* Uploading indicator */}
              {entry.uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded bg-background/60">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              )}

              {/* Uploaded checkmark */}
              {entry.uploaded && (
                <div className="absolute top-1 right-1 rounded-full bg-green-500 p-0.5">
                  <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              {/* Remove button */}
              {!entry.uploading && !entry.uploaded && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Remove ${entry.file.name}`}
                >
                  <X className="size-3" />
                </button>
              )}

              {/* Filename */}
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {entry.file.name}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Submit button */}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={
            disabled || files.length === 0 || someUploading || allUploaded
          }
        >
          {someUploading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Uploading...
            </>
          ) : allUploaded ? (
            "Screenshots Submitted"
          ) : (
            "Submit Screenshots"
          )}
        </Button>
      </div>
    </div>
  );
}
