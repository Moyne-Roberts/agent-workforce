"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteCredential } from "@/app/(dashboard)/settings/actions";

interface DeleteCredentialDialogProps {
  credential: { id: string; name: string } | null;
  linkedCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteCredentialDialog({
  credential,
  linkedCount,
  open,
  onOpenChange,
}: DeleteCredentialDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!credential) return;

    setLoading(true);

    try {
      const result = await deleteCredential(credential.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      onOpenChange(false);
      router.refresh();
      toast.success("Credential deleted");
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete credential</DialogTitle>
          <DialogDescription>
            This will permanently remove &ldquo;{credential?.name}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        {linkedCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-500/10 p-3 mt-4">
            <AlertTriangle className="size-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-600 dark:text-amber-400">
              This credential is linked to {linkedCount} project(s). Automations
              using it will fail until a replacement is provided.
            </p>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={handleDelete}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Credential"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
