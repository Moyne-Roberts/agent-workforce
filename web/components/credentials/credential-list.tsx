"use client";

import { useState } from "react";
import { MoreHorizontal, RefreshCw, Trash2, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CredentialStatusBadge } from "./credential-status-badge";
import { CredentialFailureBanner } from "./credential-failure-banner";
import { ReplaceCredentialModal } from "./replace-credential-modal";
import { DeleteCredentialDialog } from "./delete-credential-dialog";
import type {
  AuthProfileType,
  AuthProfileTypeId,
  Credential,
  CredentialWithLinks,
} from "@/lib/credentials/types";

const AUTH_TYPE_LABELS: Record<AuthProfileTypeId, string> = {
  username_password: "Username + Password",
  sso_token: "SSO Token",
  api_key: "API Key",
  certificate: "Certificate",
  totp: "TOTP",
  custom: "Custom",
};

interface CredentialListProps {
  credentials: CredentialWithLinks[];
  authProfileTypes: AuthProfileType[];
  projects: { id: string; name: string }[];
}

export function CredentialList({
  credentials,
  authProfileTypes,
  projects,
}: CredentialListProps) {
  const [replaceTarget, setReplaceTarget] = useState<Credential | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    linkedCount: number;
  } | null>(null);

  // Find first credential with failed/needs_rotation for banner
  const failedCredential = credentials.find(
    (c) => c.status === "needs_rotation" || c.status === "failed"
  );

  if (credentials.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="rounded-full bg-muted p-3">
          <KeyRound className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm font-medium">No credentials stored</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Store credentials for target systems so automations can log in
          securely. Values are encrypted and never shown again after saving.
        </p>
      </div>
    );
  }

  return (
    <div>
      {failedCredential && (
        <div className="mb-4">
          <CredentialFailureBanner
            credentialName={failedCredential.name}
            onReplace={() => setReplaceTarget(failedCredential)}
          />
        </div>
      )}

      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3 pr-4">
              Name
            </th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3 pr-4">
              Type
            </th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider pb-3 pr-4">
              Status
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
          {credentials.map((cred) => (
            <tr
              key={cred.id}
              className="border-b border-border hover:bg-muted/50 transition-colors"
            >
              <td className="py-3 pr-4 text-sm font-semibold">{cred.name}</td>
              <td className="py-3 pr-4">
                <Badge variant="outline" className="text-xs">
                  {AUTH_TYPE_LABELS[cred.auth_type]}
                </Badge>
              </td>
              <td className="py-3 pr-4">
                <CredentialStatusBadge status={cred.status} />
              </td>
              <td className="py-3 pr-4 text-sm text-muted-foreground">
                {cred.linked_project_count || "None"}
              </td>
              <td className="py-3 pr-4 text-xs text-muted-foreground">
                {new Date(cred.created_at).toLocaleDateString()}
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
                      onClick={() => setReplaceTarget(cred)}
                    >
                      <RefreshCw className="size-4" />
                      Replace
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() =>
                        setDeleteTarget({
                          id: cred.id,
                          name: cred.name,
                          linkedCount: cred.linked_project_count,
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

      <ReplaceCredentialModal
        credential={replaceTarget}
        authProfileTypes={authProfileTypes}
        open={!!replaceTarget}
        onOpenChange={(open) => {
          if (!open) setReplaceTarget(null);
        }}
      />

      <DeleteCredentialDialog
        credential={deleteTarget}
        linkedCount={deleteTarget?.linkedCount ?? 0}
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
