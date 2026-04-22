/**
 * archive-quickwins.ts — Wave 1 Quick-wins Archiver
 *
 * Archiveert auto_reply, spam en quote_reminder emails in SugarCRM.
 * Analyse resultaten: ~2.205 emails (~6.4% van alle sales emails)
 *
 * GEBRUIK:
 *   npx tsx src/archive-quickwins.ts              # dry-run (veilig, geen wijzigingen)
 *   npx tsx src/archive-quickwins.ts --execute     # echte archivering
 *   npx tsx src/archive-quickwins.ts --test        # archiveer 1 email als test
 *
 * VEREISTE SQL (eenmalig uitvoeren in Supabase Dashboard → SQL Editor):
 *   ALTER TABLE sales.email_analysis ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
 *
 * VEREISTE ENV VARS:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY (al aanwezig in .env.local)
 *   ZAPIER_CLIENT_ID, ZAPIER_CLIENT_SECRET (nodig voor Zapier SDK)
 */

import { createZapierSdk } from "@zapier/zapier-sdk";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// --- Config ---

const DRY_RUN = !process.argv.includes("--execute");
const TEST_MODE = process.argv.includes("--test");
const BATCH_SIZE = 5; // parallel Zapier calls
const ZAPIER_CONNECTION_ID = "58816663"; // Sugar CRM // NCrutzen

// Wave 1: direct archiveerbaar (geen menselijke review nodig)
const ARCHIVE_CATEGORIES = ["auto_reply", "spam"] as const;
const ARCHIVE_INTENTS = ["quote_reminder"] as const; // geautomatiseerde herinneringen

// --- Clients ---

const zapier = createZapierSdk(
  process.env.ZAPIER_CLIENT_ID
    ? {
        credentials: {
          clientId: process.env.ZAPIER_CLIENT_ID,
          clientSecret: process.env.ZAPIER_CLIENT_SECRET!,
        },
      }
    : undefined
);

const sales = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { db: { schema: "sales" } }
);

const pipeline = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { db: { schema: "email_pipeline" } }
);

// --- Types ---

interface QuickWinEmail {
  analysisId: string;
  emailId: string;
  sugarCrmId: string;
  category: string;
  emailIntent: string;
  subject?: string;
}

// --- Supabase queries ---

async function fetchQuickWinEmails(): Promise<QuickWinEmail[]> {
  console.log("Ophalen quick-win emails uit Supabase...");

  const results: QuickWinEmail[] = [];
  let offset = 0;

  while (true) {
    // Query: category IN ('auto_reply', 'spam') OR email_intent = 'quote_reminder'
    // Filter: archived_at IS NULL (niet al gearchiveerd)
    const { data, error } = await sales
      .from("email_analysis")
      .select("id, email_id, category, email_intent")
      .or(
        `category.in.(${ARCHIVE_CATEGORIES.join(",")}),email_intent.in.(${ARCHIVE_INTENTS.join(",")})`
      )
      .is("archived_at", null)
      .range(offset, offset + 999);

    if (error) {
      // Als archived_at kolom niet bestaat, geef duidelijke foutmelding
      if (error.message.includes("archived_at")) {
        console.error("\n❌ FOUT: archived_at kolom ontbreekt!");
        console.error("Voer eerst dit SQL uit in Supabase Dashboard → SQL Editor:");
        console.error(
          "  ALTER TABLE sales.email_analysis ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;\n"
        );
        process.exit(1);
      }
      throw new Error(`Supabase query fout: ${error.message}`);
    }

    if (!data || data.length === 0) break;
    results.push(
      ...data.map((r) => ({
        analysisId: r.id,
        emailId: r.email_id,
        sugarCrmId: "", // wordt hieronder gevuld
        category: r.category,
        emailIntent: r.email_intent,
      }))
    );
    if (data.length < 1000) break;
    offset += 1000;
  }

  return results;
}

async function enrichWithSugarCrmIds(
  emails: QuickWinEmail[]
): Promise<QuickWinEmail[]> {
  console.log(`Ophalen SugarCRM IDs voor ${emails.length} emails...`);

  const emailIds = emails.map((e) => e.emailId);
  const sugarCrmIdMap = new Map<string, string>();

  // Paginate ophalen van source_ids
  for (let i = 0; i < emailIds.length; i += 1000) {
    const chunk = emailIds.slice(i, i + 1000);
    const { data, error } = await pipeline
      .from("emails")
      .select("id, source_id")
      .in("id", chunk);

    if (error) throw new Error(`Pipeline query fout: ${error.message}`);
    for (const row of data || []) {
      sugarCrmIdMap.set(row.id, row.source_id);
    }
  }

  // Filter emails zonder source_id (zou niet voor mogen komen)
  const enriched = emails
    .map((e) => ({ ...e, sugarCrmId: sugarCrmIdMap.get(e.emailId) || "" }))
    .filter((e) => {
      if (!e.sugarCrmId) {
        console.warn(`  ⚠️  Geen SugarCRM ID voor email_id ${e.emailId} — overgeslagen`);
        return false;
      }
      return true;
    });

  console.log(
    `${enriched.length} emails gevonden met geldig SugarCRM ID (${emails.length - enriched.length} overgeslagen)\n`
  );
  return enriched;
}

async function markArchivedInSupabase(analysisIds: string[]): Promise<void> {
  const { error } = await sales
    .from("email_analysis")
    .update({ archived_at: new Date().toISOString() })
    .in("id", analysisIds);

  if (error) throw new Error(`Supabase update fout: ${error.message}`);
}

// --- SugarCRM archivering via Zapier SDK ---

async function archiveInSugarCrm(
  email: QuickWinEmail
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await zapier.runAction({
      app: "SugarCRMCLIAPI",
      action: "update_record",
      actionType: "write" as any,
      connectionId: ZAPIER_CONNECTION_ID,
      inputs: {
        module: "Emails",
        id: email.sugarCrmId,
        state: "Archived",
      },
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// --- Batch verwerking ---

async function processBatch(
  emails: QuickWinEmail[],
  totalProcessed: number,
  totalEmails: number
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  const succeededIds: string[] = [];

  const results = await Promise.allSettled(
    emails.map((email) => archiveInSugarCrm(email))
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const email = emails[i];

    if (result.status === "fulfilled" && result.value.success) {
      succeeded++;
      succeededIds.push(email.analysisId);
    } else {
      failed++;
      const error =
        result.status === "rejected"
          ? result.reason?.message
          : result.value.error;
      console.error(
        `  ❌ ${email.sugarCrmId} (${email.category}/${email.emailIntent}): ${error}`
      );
    }
  }

  // Markeer als gearchiveerd in Supabase
  if (succeededIds.length > 0) {
    await markArchivedInSupabase(succeededIds);
  }

  const progress = totalProcessed + emails.length;
  const pct = ((progress / totalEmails) * 100).toFixed(1);
  console.log(
    `  ${progress}/${totalEmails} (${pct}%) — ✅ ${succeeded} gearchiveerd, ❌ ${failed} mislukt`
  );

  return { succeeded, failed };
}

// --- Main ---

async function main() {
  console.log("=== WAVE 1 QUICK-WINS ARCHIVER ===");
  console.log(`Modus: ${DRY_RUN ? "DRY-RUN (geen wijzigingen)" : TEST_MODE ? "TEST (1 email)" : "EXECUTE (echt archiveren)"}\n`);

  // Haal quick-win emails op
  const emails = await fetchQuickWinEmails();

  // Verrijk met SugarCRM IDs
  const enriched = await enrichWithSugarCrmIds(emails);

  // Toon verdeling
  const byCategory: Record<string, number> = {};
  for (const e of enriched) {
    const key =
      ARCHIVE_INTENTS.includes(e.emailIntent as any)
        ? `intent:${e.emailIntent}`
        : `cat:${e.category}`;
    byCategory[key] = (byCategory[key] || 0) + 1;
  }

  console.log("📊 Te archiveren:");
  for (const [key, count] of Object.entries(byCategory).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`   ${String(count).padStart(6)}  ${key}`);
  }
  console.log(`   ------`);
  console.log(`   ${String(enriched.length).padStart(6)}  TOTAAL\n`);

  if (enriched.length === 0) {
    console.log("✅ Geen emails te archiveren — alles al verwerkt.");
    return;
  }

  // Dry-run: stop hier
  if (DRY_RUN) {
    console.log(
      "ℹ️  DRY-RUN — geen wijzigingen gemaakt.\n" +
        "Voer uit met --execute om te archiveren, of --test voor 1 email.\n"
    );
    return;
  }

  // Test mode: verwerk slechts 1 email
  const toProcess = TEST_MODE ? enriched.slice(0, 1) : enriched;
  if (TEST_MODE) {
    console.log(`🧪 TEST MODE: archiveer 1 email (${toProcess[0].sugarCrmId})`);
    console.log(
      `   Categorie: ${toProcess[0].category} / Intent: ${toProcess[0].emailIntent}\n`
    );
  }

  console.log(`\n🚀 Start archivering (${BATCH_SIZE} parallel)...\n`);

  const startTime = Date.now();
  let totalSucceeded = 0;
  let totalFailed = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    const { succeeded, failed } = await processBatch(batch, i, toProcess.length);
    totalSucceeded += succeeded;
    totalFailed += failed;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== KLAAR ===`);
  console.log(`Tijd: ${elapsed}s`);
  console.log(`✅ Gearchiveerd: ${totalSucceeded}`);
  console.log(`❌ Mislukt: ${totalFailed}`);
  console.log(
    `📂 Resterende quick-wins: ${enriched.length - toProcess.length} (volgende run)`
  );
}

main().catch((err) => {
  console.error("Fatale fout:", err);
  process.exit(1);
});
