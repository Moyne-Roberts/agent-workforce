"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import type { TerminalEntry } from "@/lib/systems/types";
import { TerminalApprovalEntry } from "./terminal-approval-entry";
import { TerminalSOPPreview } from "./terminal-sop-preview";
import { TerminalScreenshotUpload } from "./terminal-screenshot-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { submitSOPUpload } from "@/lib/systems/actions";

interface EntryInteractionProps {
  entry: TerminalEntry;
}

/**
 * Renders type-specific inline UI within a terminal entry card.
 * Acts as a dispatcher -- each entry type gets its own UI treatment.
 *
 * Plan 02 implements: status, approval, prompt.
 * Plan 03 adds: upload (SOP and screenshots).
 * Plan 04 will add: annotation-review.
 */
export function EntryInteraction({ entry }: EntryInteractionProps) {
  switch (entry.type) {
    case "status":
      // Status entries only show the card text (rendered by TerminalEntryCard)
      return null;

    case "approval":
      return <TerminalApprovalEntry entry={entry} />;

    case "prompt": {
      // Render action buttons if present in metadata
      const actions = entry.metadata?.actions as
        | Array<{ label: string; action: string }>
        | undefined;

      if (!actions || actions.length === 0) return null;

      return (
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.action}
              variant="outline"
              size="sm"
            >
              {action.label}
            </Button>
          ))}
        </div>
      );
    }

    case "upload": {
      const uploadType = entry.metadata?.uploadType as string | undefined;

      if (uploadType === "sop") {
        return (
          <SOPUploadInteraction
            runId={entry.metadata?.runId as string}
            taskId={entry.metadata?.taskId as string}
          />
        );
      }

      if (uploadType === "screenshots") {
        return (
          <ScreenshotUploadInteraction
            runId={entry.metadata?.runId as string}
            taskId={entry.metadata?.taskId as string}
            sopText={entry.metadata?.sopText as string}
          />
        );
      }

      return null;
    }

    // annotation-review type will be added in Plan 04
    case "annotation-review":
    case "user-input":
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// SOP Upload Interaction (upload .md file or paste markdown)
// ---------------------------------------------------------------------------

function SOPUploadInteraction({
  runId,
  taskId,
}: {
  runId: string;
  taskId: string;
}) {
  const [sopContent, setSopContent] = useState("");
  const [phase, setPhase] = useState<"input" | "preview" | "confirmed" | "screenshots">("input");
  const [screenshotPaths, setScreenshotPaths] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === "string") {
          setSopContent(text);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    []
  );

  const handleSubmitSOP = useCallback(() => {
    if (sopContent.trim().length >= 10) {
      setPhase("preview");
    }
  }, [sopContent]);

  const handleConfirm = useCallback(() => {
    setPhase("confirmed");
    // Transition to screenshot upload phase
    setPhase("screenshots");
  }, []);

  const handleScreenshotsComplete = useCallback(
    async (paths: string[]) => {
      setScreenshotPaths(paths);
      // Submit SOP + screenshot paths to Inngest
      await submitSOPUpload(runId, taskId, sopContent, paths);
    },
    [runId, taskId, sopContent]
  );

  if (phase === "screenshots") {
    return (
      <div className="mt-3">
        <TerminalSOPPreview
          markdown={sopContent}
          onConfirm={() => {}}
          confirmed={true}
        />
        <TerminalScreenshotUpload
          runId={runId}
          taskId={taskId}
          onUploadComplete={handleScreenshotsComplete}
          disabled={screenshotPaths.length > 0}
        />
      </div>
    );
  }

  if (phase === "preview") {
    return (
      <TerminalSOPPreview
        markdown={sopContent}
        onConfirm={handleConfirm}
        confirmed={false}
      />
    );
  }

  // Input phase: tabs for upload file or paste markdown
  return (
    <div className="mt-3">
      <p className="mb-2 text-sm text-muted-foreground">
        Upload your SOP document (.md) or paste the markdown content directly
        below.
      </p>

      <Tabs defaultValue="paste">
        <TabsList>
          <TabsTrigger value="upload">
            <Upload className="size-3.5 mr-1" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="paste">
            <FileText className="size-3.5 mr-1" />
            Paste Markdown
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-3">
          <div
            className="flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors hover:border-muted-foreground/50"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Drop .md file here or click to browse"
          >
            <Upload className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drop .md file here or click to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,text/markdown"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          {sopContent && (
            <p className="mt-2 text-xs text-muted-foreground">
              File loaded ({sopContent.length} characters)
            </p>
          )}
        </TabsContent>

        <TabsContent value="paste" className="mt-3">
          <Textarea
            placeholder="Paste your SOP markdown here..."
            rows={6}
            value={sopContent}
            onChange={(e) => setSopContent(e.target.value)}
          />
        </TabsContent>
      </Tabs>

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          onClick={handleSubmitSOP}
          disabled={sopContent.trim().length < 10}
        >
          Submit SOP
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screenshot Upload Interaction (standalone, for entries of uploadType "screenshots")
// ---------------------------------------------------------------------------

function ScreenshotUploadInteraction({
  runId,
  taskId,
  sopText,
}: {
  runId: string;
  taskId: string;
  sopText: string;
}) {
  const [submitted, setSubmitted] = useState(false);

  const handleUploadComplete = useCallback(
    async (paths: string[]) => {
      await submitSOPUpload(runId, taskId, sopText || "", paths);
      setSubmitted(true);
    },
    [runId, taskId, sopText]
  );

  return (
    <TerminalScreenshotUpload
      runId={runId}
      taskId={taskId}
      onUploadComplete={handleUploadComplete}
      disabled={submitted}
    />
  );
}
