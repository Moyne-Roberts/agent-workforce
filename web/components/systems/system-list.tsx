"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, Link2, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { deleteSystem } from "@/lib/systems/actions";
import { SystemProjectLinker } from "./system-project-linker";
import type { IntegrationMethod, SystemWithLinks } from "@/lib/systems/types";

const METHOD_LABELS: Record<IntegrationMethod, string> = {
  api: "API",
  "browser-automation": "Browser Automation",
  "knowledge-base": "Knowledge Base",
  manual: "Manual",
};

const METHOD_BADGE_STYLES: Record<IntegrationMethod, string> = {
  api: "bg-green-500/10 text-green-600 border-green-200",
  "browser-automation": "bg-amber-500/10 text-amber-600 border-amber-200",
  "knowledge-base": "bg-blue-500/10 text-blue-600 border-blue-200",
  manual: "",
};

interface SystemListProps {
  systems: SystemWithLinks[];
  projects: Array<{ id: string; name: string }>;
}

export function SystemList({ systems, projects }: SystemListProps) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    linkedCount: number;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [linkerTarget, setLinkerTarget] = useState<{
    systemId: string;
    linkedProjectIds: string[];
  } | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleteLoading(true);
    try {
      const result = await deleteSystem(deleteTarget.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setDeleteTarget(null);
      router.refresh();
      toast.success("System deleted");
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (systems.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="rounded-full bg-muted p-3">
          <Globe className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm font-medium">No systems registered</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Add target systems so the pipeline can detect when browser automation
          is needed. Click Add System to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3 pr-4">
              System Name
            </th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3 pr-4">
              Method
            </th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3 pr-4">
              URL
            </th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3 pr-4">
              Projects
            </th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3 pr-4">
              Created
            </th>
            <th className="w-10 pb-3" />
          </tr>
        </thead>
        <tbody>
          {systems.map((system) => (
            <tr
              key={system.id}
              className="border-b border-border hover:bg-muted/50 transition-colors"
            >
              <td className="py-3 pr-4 text-sm font-semibold">
                {system.name}
              </td>
              <td className="py-3 pr-4">
                <Badge
                  variant={
                    system.integration_method === "manual"
                      ? "outline"
                      : "default"
                  }
                  className={
                    system.integration_method === "manual"
                      ? "text-muted-foreground"
                      : METHOD_BADGE_STYLES[system.integration_method]
                  }
                >
                  {METHOD_LABELS[system.integration_method]}
                </Badge>
              </td>
              <td className="py-3 pr-4 text-sm text-muted-foreground max-w-48 truncate">
                {system.url || "--"}
              </td>
              <td className="py-3 pr-4 text-sm text-muted-foreground">
                {system.linked_project_count || "None"}
              </td>
              <td className="py-3 pr-4 text-xs text-muted-foreground">
                {new Date(system.created_at).toLocaleDateString()}
              </td>
              <td className="py-3 w-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        setLinkerTarget({
                          systemId: system.id,
                          linkedProjectIds: [],
                        })
                      }
                    >
                      <Link2 className="size-4" />
                      Link to Project
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() =>
                        setDeleteTarget({
                          id: system.id,
                          name: system.name,
                          linkedCount: system.linked_project_count,
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}</DialogTitle>
            <DialogDescription>
              This system will be unlinked from all projects. Automations
              referencing it will need to be updated.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteLoading}
              onClick={handleDelete}
            >
              {deleteLoading ? "Deleting..." : "Delete System"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project linker dialog */}
      <Dialog
        open={!!linkerTarget}
        onOpenChange={(open) => {
          if (!open) setLinkerTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link to Projects</DialogTitle>
            <DialogDescription>
              Select which projects this system should be linked to.
            </DialogDescription>
          </DialogHeader>
          {linkerTarget && (
            <SystemProjectLinker
              systemId={linkerTarget.systemId}
              linkedProjectIds={linkerTarget.linkedProjectIds}
              projects={projects}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
