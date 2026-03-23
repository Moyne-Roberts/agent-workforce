import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Shield, Activity } from "lucide-react";
import { CredentialList } from "@/components/credentials/credential-list";
import { CreateCredentialModal } from "@/components/credentials/create-credential-modal";
import { HealthDashboard } from "@/components/health/health-dashboard";
import type { CredentialWithLinks, HealthCheckResult } from "@/lib/credentials/types";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;

  // Authenticate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch credentials (RLS-scoped to created_by)
  const { data: credentials } = await supabase
    .from("credentials")
    .select(
      "id, name, auth_type, status, failed_at, key_version, created_by, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  // Fetch all credential_project_links for link counts
  const { data: links } = await supabase
    .from("credential_project_links")
    .select("credential_id, project_id");

  // Count links per credential
  const linkCounts = new Map<string, number>();
  (links ?? []).forEach((l: { credential_id: string }) =>
    linkCounts.set(l.credential_id, (linkCounts.get(l.credential_id) || 0) + 1)
  );

  // Build CredentialWithLinks[]
  const credentialsWithLinks: CredentialWithLinks[] = (credentials ?? []).map(
    (c) =>
      ({
        ...c,
        linked_project_count: linkCounts.get(c.id) || 0,
      }) as CredentialWithLinks
  );

  // Fetch auth profile types
  const admin = createAdminClient();
  const { data: authProfileTypes } = await admin
    .from("auth_profile_types")
    .select("*")
    .order("id");

  // Fetch projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name");

  // Fetch latest health check
  const { data: healthResult } = await admin
    .from("health_checks")
    .select("*")
    .eq("id", "latest")
    .maybeSingle();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Manage credentials, authentication profiles, and system health
      </p>

      <Tabs defaultValue={tab || "credentials"} className="mt-6">
        <TabsList>
          <TabsTrigger value="credentials">
            <KeyRound className="mr-1.5 size-3.5" />
            Credentials
          </TabsTrigger>
          <TabsTrigger value="auth-profiles">
            <Shield className="mr-1.5 size-3.5" />
            Auth Profiles
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="mr-1.5 size-3.5" />
            Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credentials">
          <div className="flex items-center justify-between mt-4">
            <div>
              <h2 className="text-lg font-semibold">Credentials</h2>
              <p className="text-sm text-muted-foreground">
                Manage encrypted credentials for target system automations
              </p>
            </div>
            <CreateCredentialModal
              authProfileTypes={authProfileTypes ?? []}
              projects={projects ?? []}
            />
          </div>
          <div className="mt-4">
            <CredentialList
              credentials={credentialsWithLinks}
              authProfileTypes={authProfileTypes ?? []}
              projects={projects ?? []}
            />
          </div>
        </TabsContent>

        <TabsContent value="auth-profiles">
          <div className="mt-4">
            <h2 className="text-lg font-semibold">Authentication Profiles</h2>
            <p className="text-sm text-muted-foreground">
              Templates defining how automations log into different systems
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {(authProfileTypes ?? []).map(
                (profile: {
                  id: string;
                  name: string;
                  description: string;
                  field_schema: { fields: unknown[] };
                }) => (
                  <Card key={profile.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{profile.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {profile.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {profile.field_schema.fields.length} field(s)
                      </p>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="health">
          <HealthDashboard
            initialResult={healthResult as HealthCheckResult | null}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
