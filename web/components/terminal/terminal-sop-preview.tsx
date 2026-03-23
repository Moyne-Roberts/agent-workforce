"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface TerminalSOPPreviewProps {
  markdown: string;
  onConfirm: () => void;
  confirmed: boolean;
}

/**
 * Renders a markdown preview of the uploaded/pasted SOP with a "Looks good"
 * confirmation button. Once confirmed, shows a green checkmark and status text.
 *
 * Uses react-markdown with remark-gfm for GitHub Flavored Markdown support
 * (tables, task lists, strikethrough).
 */
export function TerminalSOPPreview({
  markdown,
  onConfirm,
  confirmed,
}: TerminalSOPPreviewProps) {
  return (
    <div className="mt-3 rounded-lg border bg-background p-4">
      <h4 className="text-sm font-medium mb-3">SOP Preview</h4>

      {/* Scrollable markdown container */}
      <div className="prose prose-sm max-w-none max-h-96 overflow-y-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>

      {/* Confirmation area */}
      <div className="mt-4 flex justify-end">
        {confirmed ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="size-4" />
            <span>SOP confirmed</span>
          </div>
        ) : (
          <Button onClick={onConfirm} size="sm">
            Looks good
          </Button>
        )}
      </div>
    </div>
  );
}
