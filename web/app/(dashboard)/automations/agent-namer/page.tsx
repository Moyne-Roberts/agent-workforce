import { createAdminClient } from "@/lib/supabase/admin";
import { NamerForm } from "./namer-form";

export default async function AgentNamerPage() {
  const supabase = createAdminClient();

  const { data: saved } = await supabase
    .from("agent_names")
    .select(
      "id, agent_key, agent_description, name, title, initial, domain, rationale, orq_agent_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Agent Namer</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Geef elke (sub)agent in de workforce een Engelse voornaam + korte
          titel. De eerste letter matcht het domein (S = Sales, D = Debtor,
          O = Operations, enzovoort).
        </p>
      </div>

      <NamerForm />

      <section className="space-y-3">
        <h2 className="font-semibold">Team roster</h2>
        {!saved || saved.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nog geen namen toegewezen. Genereer er één hierboven.
          </p>
        ) : (
          <ul className="divide-y border rounded-lg">
            {saved.map((row) => (
              <li key={row.id} className="p-4 flex items-start gap-4">
                <div className="flex-none w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {row.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">
                    {row.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      {row.title}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <code className="font-mono">{row.agent_key}</code> · domain:{" "}
                    {row.domain}
                  </div>
                  <div className="text-sm mt-1 text-muted-foreground line-clamp-2">
                    {row.agent_description}
                  </div>
                  <div className="text-xs mt-1 italic text-muted-foreground/80">
                    {row.rationale}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
