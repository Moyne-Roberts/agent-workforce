"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/client";
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
import { Plus, Loader2 } from "lucide-react";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  description: z.string().max(500).optional(),
});

interface CreateProjectModalProps {
  trigger?: React.ReactNode;
}

export function CreateProjectModal({ trigger }: CreateProjectModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = createProjectSchema.safeParse({ name, description: description || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be signed in to create a project.");
        setLoading(false);
        return;
      }

      // Insert project -- the database trigger auto-adds creator as project member
      const { error: insertError } = await supabase
        .from("projects")
        .insert({
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          created_by: user.id,
        });

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      // Reset form and close
      setName("");
      setDescription("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" />
            Create Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Create a new project to organize your pipeline work.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="project-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="project-name"
                placeholder="My Pipeline Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="project-description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="project-description"
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
