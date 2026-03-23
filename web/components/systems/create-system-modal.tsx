"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSystem } from "@/lib/systems/actions";
import type { IntegrationMethod } from "@/lib/systems/types";

const INTEGRATION_METHODS: {
  value: IntegrationMethod;
  label: string;
  description: string;
}[] = [
  {
    value: "api",
    label: "API",
    description: "System has a programmatic API interface",
  },
  {
    value: "browser-automation",
    label: "Browser Automation",
    description: "System requires browser interaction (no API)",
  },
  {
    value: "knowledge-base",
    label: "Knowledge Base",
    description: "System is a knowledge/document source",
  },
  {
    value: "manual",
    label: "Manual",
    description: "System requires manual human interaction",
  },
];

interface CreateSystemModalProps {
  projects: Array<{ id: string; name: string }>;
}

export function CreateSystemModal({ projects }: CreateSystemModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [integrationMethod, setIntegrationMethod] =
    useState<IntegrationMethod>("api");
  const [url, setUrl] = useState("");
  const [authNotes, setAuthNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleProject(projectId: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  }

  function resetForm() {
    setName("");
    setIntegrationMethod("api");
    setUrl("");
    setAuthNotes("");
    setNotes("");
    setSelectedProjectIds([]);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setLoading(true);

    try {
      const result = await createSystem({
        name: name.trim(),
        integrationMethod,
        url: url.trim() || undefined,
        authNotes: authNotes.trim() || undefined,
        notes: notes.trim() || undefined,
        projectIds:
          selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      resetForm();
      setOpen(false);
      router.refresh();
      toast.success("System added");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 size-4" />
          Add System
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add System</DialogTitle>
            <DialogDescription>
              Register a target system so the pipeline can detect when browser
              automation is needed.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="system-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="system-name"
                placeholder="NXT, iController, SAP..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>

            {/* Integration Method */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Integration Method <span className="text-destructive">*</span>
              </label>
              <div className="flex flex-col gap-2">
                {INTEGRATION_METHODS.map((method) => (
                  <label
                    key={method.value}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      integrationMethod === method.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="integration-method"
                      value={method.value}
                      checked={integrationMethod === method.value}
                      onChange={() => setIntegrationMethod(method.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-semibold">
                        {method.label}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {method.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* URL */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="system-url" className="text-sm font-medium">
                URL{" "}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <Input
                id="system-url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Auth Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Auth Notes{" "}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <Textarea
                placeholder="How to authenticate with this system..."
                value={authNotes}
                onChange={(e) => setAuthNotes(e.target.value)}
                disabled={loading}
                rows={2}
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Notes{" "}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <Textarea
                placeholder="Additional notes about this system..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                rows={2}
              />
            </div>

            {/* Project linking */}
            {projects.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Link to Projects{" "}
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                </label>
                <div className="flex flex-col gap-1">
                  {projects.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(p.id)}
                        onChange={() => toggleProject(p.id)}
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {loading ? "Adding..." : "Add System"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
