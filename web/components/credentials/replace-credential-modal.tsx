"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LockKeyhole, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { replaceCredential } from "@/app/(dashboard)/settings/actions";
import type {
  AuthProfileType,
  AuthProfileTypeId,
} from "@/lib/credentials/types";

interface ReplaceCredentialModalProps {
  credential: {
    id: string;
    name: string;
    auth_type: AuthProfileTypeId;
  } | null;
  authProfileTypes: AuthProfileType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReplaceCredentialModal({
  credential,
  authProfileTypes,
  open,
  onOpenChange,
}: ReplaceCredentialModalProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setValues({});
      setError(null);
    }
  }, [open]);

  const profile = credential
    ? authProfileTypes.find((p) => p.id === credential.auth_type)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!credential) return;

    if (Object.keys(values).length === 0) {
      setError("At least one value is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await replaceCredential(credential.id, values);
      if (result.error) {
        setError(result.error);
        return;
      }

      onOpenChange(false);
      router.refresh();
      toast.success("Credential replaced");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Replace Credential</DialogTitle>
            <DialogDescription>
              The previous value will be permanently overwritten.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <p className="text-sm font-semibold">{credential?.name}</p>

            {profile &&
              profile.field_schema.fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold">
                    {field.label}
                    {field.required && (
                      <span className="text-destructive ml-0.5">*</span>
                    )}
                  </label>
                  {field.type === "secret" ? (
                    <>
                      <Input
                        type="password"
                        autoComplete="off"
                        placeholder="Paste your new credential value"
                        onPaste={(e) => {
                          e.preventDefault();
                          const text = e.clipboardData.getData("text");
                          setValues((prev) => ({
                            ...prev,
                            [field.key]: text,
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (
                            !(e.metaKey || e.ctrlKey) ||
                            e.key !== "v"
                          ) {
                            if (
                              !["Tab", "Escape"].includes(e.key)
                            ) {
                              e.preventDefault();
                            }
                          }
                        }}
                        value={
                          values[field.key]
                            ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                            : ""
                        }
                        readOnly
                      />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <LockKeyhole className="size-3" />
                        Write-once -- value cannot be viewed after saving
                      </div>
                    </>
                  ) : (
                    <Input
                      value={values[field.key] || ""}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      disabled={loading}
                    />
                  )}
                </div>
              ))}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Replacing..." : "Replace Credential"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
