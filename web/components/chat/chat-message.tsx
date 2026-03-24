"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageBubbleProps {
  role: "assistant" | "user";
  content: string;
  streaming?: boolean;
  stageName?: string;
}

export function ChatMessageBubble({ role, content, streaming, stageName }: ChatMessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={cn("mb-3 flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {isUser ? (
          content
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        )}
        {streaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current opacity-70" />
        )}
        {!isUser && stageName && (
          <div className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground opacity-60">
            {stageName.replace(/-/g, " ")}
          </div>
        )}
      </div>
    </div>
  );
}
