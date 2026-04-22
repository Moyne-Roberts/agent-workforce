import { AgentRunBoard } from "@/components/automations/agent-run-board";

export const dynamic = "force-dynamic";

export default function DebtorEmailSwarmPage() {
  return (
    <div className="flex h-full flex-col p-6">
      <AgentRunBoard
        title="Debiteuren Email Swarm"
        prefix="debtor-email"
        description="Live overzicht van alle agent runs die binnenkomende debiteurenmail classificeren en afhandelen. Klik een kaart voor details en screenshots."
      />
    </div>
  );
}
