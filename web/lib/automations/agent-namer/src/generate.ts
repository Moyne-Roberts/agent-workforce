import { config as dotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load env from web/.env.local (four levels up from this file)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv({ path: resolve(__dirname, "../../../../.env.local") });
dotenv();

const ORQ_API_KEY = process.env.ORQ_API_KEY;
const AGENT_KEY = "AgentNamer";
const ORQ_URL = `https://api.orq.ai/v2/agents/${AGENT_KEY}/responses`;

if (!ORQ_API_KEY) {
  console.error("Missing ORQ_API_KEY. Add it to web/.env.local.");
  process.exit(1);
}

interface NameResult {
  name: string;
  title: string;
  initial: string;
  domain: string;
  rationale: string;
}

function parseArgs(argv: string[]): { description: string; domain?: string } {
  let domain: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--domain" && argv[i + 1]) {
      domain = argv[++i];
    } else if (a.startsWith("--domain=")) {
      domain = a.slice("--domain=".length);
    } else {
      positional.push(a);
    }
  }
  return { description: positional.join(" ").trim(), domain };
}

async function generateName(
  description: string,
  domain?: string,
): Promise<NameResult> {
  const userText = domain
    ? `Domain hint: ${domain}\nAgent task: ${description}`
    : description;

  const res = await fetch(ORQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ORQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        role: "user",
        parts: [{ kind: "text", text: userText }],
      },
      block: true,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`Orq ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();

  // Walk the A2A response to find the assistant text. Orq returns
  // { output: [{ role, parts: [{ kind: "text", text }] }], ... }.
  const texts: string[] = [];
  const messageArrays = [data?.output, data?.messages, data?.result?.output].filter(Array.isArray);
  for (const arr of messageArrays) {
    for (const m of arr) {
      for (const p of m?.parts ?? []) {
        if (typeof p?.text === "string" && (p.kind === "text" || p.type === "text")) {
          texts.push(p.text);
        }
      }
    }
  }

  const text = texts[texts.length - 1];
  if (typeof text !== "string") {
    throw new Error(`Could not extract text from Orq response: ${JSON.stringify(data).slice(0, 600)}`);
  }

  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned) as NameResult;
}

async function main() {
  const { description, domain } = parseArgs(process.argv.slice(2));

  if (!description) {
    console.error("Usage: npx tsx src/generate.ts [--domain <domain>] \"<agent task description>\"");
    console.error("Example: npx tsx src/generate.ts \"Classifies incoming sales emails\"");
    process.exit(1);
  }

  const result = await generateName(description, domain);

  // Pretty banner + JSON for piping
  console.error(`\n  ${result.initial}  ${result.name} ${result.title}`);
  console.error(`     ${result.rationale}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
