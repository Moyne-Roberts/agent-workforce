"use client";

import type { LucideIcon } from "lucide-react";
import {
  KeyRound,
  Shield,
  Key,
  FileKey,
  Smartphone,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthProfileTypeId } from "@/lib/credentials/types";

const AUTH_TYPE_OPTIONS: {
  id: AuthProfileTypeId;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "username_password",
    label: "Username + Password",
    description: "Standard username and password login",
    icon: KeyRound,
  },
  {
    id: "sso_token",
    label: "SSO / Azure AD Token",
    description: "Single sign-on bearer token",
    icon: Shield,
  },
  {
    id: "api_key",
    label: "API Key / Bearer Token",
    description: "API key or bearer token authentication",
    icon: Key,
  },
  {
    id: "certificate",
    label: "Client Certificate / mTLS",
    description: "Certificate-based mutual TLS authentication",
    icon: FileKey,
  },
  {
    id: "totp",
    label: "TOTP (2FA)",
    description: "Time-based one-time password",
    icon: Smartphone,
  },
  {
    id: "custom",
    label: "Custom",
    description: "Define custom key-value credential fields",
    icon: Settings,
  },
];

export function AuthProfileTypeSelector({
  selectedType,
  onSelect,
}: {
  selectedType: AuthProfileTypeId;
  onSelect: (type: AuthProfileTypeId) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {AUTH_TYPE_OPTIONS.map((option) => {
        const selected = selectedType === option.id;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            className={cn(
              "cursor-pointer rounded-lg border p-3 transition-colors text-left w-full",
              selected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
            onClick={() => onSelect(option.id)}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
