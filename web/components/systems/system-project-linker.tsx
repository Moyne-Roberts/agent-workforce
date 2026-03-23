"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  linkSystemToProject,
  unlinkSystemFromProject,
} from "@/lib/systems/actions";

interface SystemProjectLinkerProps {
  systemId: string;
  linkedProjectIds: string[];
  projects: Array<{ id: string; name: string }>;
}

export function SystemProjectLinker({
  systemId,
  linkedProjectIds,
  projects,
}: SystemProjectLinkerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const linked = projects.filter((p) => linkedProjectIds.includes(p.id));
  const available = projects.filter((p) => !linkedProjectIds.includes(p.id));

  async function handleLink(projectId: string) {
    setLoading(projectId);
    const res = await linkSystemToProject(systemId, projectId);
    if (res.error) toast.error(res.error);
    else toast.success("System linked to project");
    setLoading(null);
    router.refresh();
  }

  async function handleUnlink(projectId: string) {
    setLoading(projectId);
    const res = await unlinkSystemFromProject(systemId, projectId);
    if (res.error) toast.error(res.error);
    else toast.success("System unlinked");
    setLoading(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Linked Projects</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Projects that reference this system for automation detection
        </p>
      </div>

      {linked.length > 0 ? (
        <div className="flex flex-col gap-2">
          {linked.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <Globe className="size-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{project.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={loading === project.id}
                onClick={() => handleUnlink(project.id)}
              >
                <Unlink className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No projects linked to this system.
        </p>
      )}

      {available.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2">Available to link</h3>
          <div className="flex flex-col gap-2">
            {available.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between rounded-lg border border-dashed p-3"
              >
                <div className="flex items-center gap-3">
                  <Globe className="size-4 text-muted-foreground" />
                  <span className="text-sm">{project.name}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading === project.id}
                  onClick={() => handleLink(project.id)}
                >
                  <Link2 className="size-4" />
                  Link
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
