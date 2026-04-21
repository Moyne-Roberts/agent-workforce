import { NextRequest, NextResponse } from "next/server";
import { createZapierSdk } from "@zapier/zapier-sdk";

const WEBHOOK_SECRET = process.env.AUTOMATION_WEBHOOK_SECRET!;
const OUTLOOK_CONNECTION_ID = "56014785";
const GRAPH = "https://graph.microsoft.com/v1.0";
const MAILBOX = "debiteuren@smeba.nl";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-automation-secret");
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const zapier = createZapierSdk();

  async function graph(path: string): Promise<unknown> {
    const res = await zapier.fetch(`${GRAPH}${path}`, {
      method: "GET",
      connectionId: OUTLOOK_CONNECTION_ID,
      headers: { ConsistencyLevel: "eventual" },
    });
    if (!res.ok) {
      throw new Error(`${path} → ${res.status} ${await res.text()}`);
    }
    return res.json();
  }

  try {
    const inbox = (await graph(
      `/users/${MAILBOX}/mailFolders/inbox?$select=displayName,totalItemCount,unreadItemCount`,
    )) as { displayName: string; totalItemCount: number; unreadItemCount: number };

    const folders = (await graph(
      `/users/${MAILBOX}/mailFolders?$select=displayName,totalItemCount,unreadItemCount&$top=50`,
    )) as {
      value: Array<{ displayName: string; totalItemCount: number; unreadItemCount: number }>;
    };

    // Mailbox-wide total
    const countRes = await zapier.fetch(`${GRAPH}/users/${MAILBOX}/messages/$count`, {
      method: "GET",
      connectionId: OUTLOOK_CONNECTION_ID,
      headers: { ConsistencyLevel: "eventual" },
    });
    const totalAll = countRes.ok ? Number((await countRes.text()).trim()) : null;

    const topFolders = folders.value
      .filter((f) => f.totalItemCount > 0)
      .sort((a, b) => b.totalItemCount - a.totalItemCount)
      .slice(0, 20);

    return NextResponse.json({
      mailbox: MAILBOX,
      inbox: {
        total: inbox.totalItemCount,
        unread: inbox.unreadItemCount,
      },
      mailbox_total_messages: totalAll,
      folders: topFolders,
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
