"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LockKeyhole, Plus, Loader2, Trash2 } from "lucide-react";
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
import { AuthProfileTypeSelector } from "./auth-profile-type-selector";
import { storeCredential } from "@/app/(dashboard)/settings/actions";
import type {
  AuthProfileType,
  AuthProfileTypeId,
} from "@/lib/credentials/types";

interface CreateCredentialModalProps {
  authProfileTypes: AuthProfileType[];
  projects: { id: string; name: string }[];
}

export function CreateCredentialModal({
  authProfileTypes,
  projects,
}: CreateCredentialModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedAuthType, setSelectedAuthType] =
    useState<AuthProfileTypeId>("username_password");
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customFields, setCustomFields] = useState<
    { key: string; value: string }[]
  >([]);

  const profile = authProfileTypes.find((p) => p.id === selectedAuthType);

  function toggleProject(projectId: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    // Build final values
    let finalValues: Record<string, string>;
    if (selectedAuthType === "custom") {
      finalValues = { ...values };
      for (const field of customFields) {
        if (field.key.trim() && field.value) {
          finalValues[field.key.trim()] = field.value;
        }
      }
    } else {
      finalValues = { ...values };
    }

    // Validate required fields
    if (profile && selectedAuthType !== "custom") {
      for (const field of profile.field_schema.fields) {
        if (field.required && !finalValues[field.key]) {
          setError(`${field.label} is required`);
          return;
        }
      }
    }

    if (Object.keys(finalValues).length === 0) {
      setError("At least one credential value is required");
      return;
    }

    setLoading(true);

    try {
      const result = await storeCredential({
        name,
        authType: selectedAuthType,
        values: finalValues,
        projectIds:
          selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      // Reset state and close
      setName("");
      setSelectedAuthType("username_password");
      setValues({});
      setSelectedProjectIds([]);
      setCustomFields([]);
      setOpen(false);
      router.refresh();
      toast.success("Credential stored securely");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Store Credential
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Store Credential</DialogTitle>
            <DialogDescription>
              Securely store credentials for target system automations. Values
              are encrypted and cannot be viewed after saving.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cred-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="cred-name"
                placeholder="NXT Production Login"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name to identify this credential
              </p>
            </div>

            {/* Auth Type Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Authentication Type
              </label>
              <AuthProfileTypeSelector
                selectedType={selectedAuthType}
                onSelect={(t) => {
                  setSelectedAuthType(t);
                  setValues({});
                  setCustomFields([]);
                }}
              />
            </div>

            {/* Dynamic Fields */}
            {profile &&
              selectedAuthType !== "custom" &&
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
                        placeholder="Paste your credential value"
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

            {/* Custom fields */}
            {selectedAuthType === "custom" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Custom Fields</label>
                {customFields.map((cf, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="Field name"
                      value={cf.key}
                      onChange={(e) => {
                        const updated = [...customFields];
                        updated[i] = { ...cf, key: e.target.value };
                        setCustomFields(updated);
                      }}
                      className="flex-1"
                    />
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder="Paste value"
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData.getData("text");
                        const updated = [...customFields];
                        updated[i] = { ...cf, value: text };
                        setCustomFields(updated);
                      }}
                      onKeyDown={(e) => {
                        if (!(e.metaKey || e.ctrlKey) || e.key !== "v") {
                          if (!["Tab", "Escape"].includes(e.key)) {
                            e.preventDefault();
                          }
                        }
                      }}
                      value={cf.value ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : ""}
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setCustomFields((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCustomFields((prev) => [
                      ...prev,
                      { key: "", value: "" },
                    ])
                  }
                >
                  <Plus className="size-4" />
                  Add Field
                </Button>
              </div>
            )}

            {/* Project linking */}
            {projects.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Link to Projects{" "}
                  <span className="text-muted-foreground">(optional)</span>
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
              onClick={() => setOpen(false)}
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
              {loading ? "Storing..." : "Store Credential"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
