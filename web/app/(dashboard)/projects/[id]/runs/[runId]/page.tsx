import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RunDetailClient } from "./run-detail-client";

interface PageProps {
  params: Promise<{ id: string; runId: string }>;
}

export default async function RunDetailPage({ params }: PageProps) {
  const { id: projectId, runId } = await params;
  const supabase = await createClient();

  // Fetch project name for breadcrumb
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  // Fetch run with steps (RLS enforces access)
  const { data: run, error } = await supabase
    .from("pipeline_runs")
    .select("*, pipeline_steps(*)")
    .eq("id", runId)
    .single();

  if (error || !run) {
    notFound();
  }

  // Sort steps by step_order
  const steps = (run.pipeline_steps ?? []).sort(
    (a: { step_order: number }, b: { step_order: number }) =>
      a.step_order - b.step_order
  );

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="size-3.5" />
        <Link
          href={`/projects/${projectId}`}
          className="hover:text-foreground transition-colors"
        >
          {project?.name ?? "Project"}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">
          {run.name || "Pipeline Run"}
        </span>
      </nav>

      <RunDetailClient
        run={{ ...run, pipeline_steps: steps }}
        projectId={projectId}
      />
    </div>
  );
}
