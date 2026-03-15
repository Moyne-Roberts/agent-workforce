import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Invite-only enforcement for email/password users.
  // Azure SSO users always get through (they are org members).
  // Email/password users must have at least one project membership.
  const isAzureUser = user.app_metadata?.provider === "azure";

  if (!isAzureUser) {
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.id)
      .limit(1);

    if (!memberships || memberships.length === 0) {
      redirect("/login?error=no_access");
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <main className="flex-1 overflow-auto">{children}</main>
    </SidebarProvider>
  );
}
