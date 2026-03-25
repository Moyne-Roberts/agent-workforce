/**
 * Prompt adapter: translates pipeline .md files into Claude API calls
 * via the Orq.ai router for unified billing.
 *
 * 1. Fetches the .md file from GitHub (runtime, not bundled)
 * 2. Strips YAML frontmatter using gray-matter
 * 3. Builds a user message with context formatted as XML tags
 * 4. Calls Orq.ai router (OpenAI-compatible) with the .md content as system message
 * 5. Returns the text response
 */

import matter from "gray-matter";
import { getStageByName, getStageUrl } from "./stages";

const PIPELINE_REPO_RAW_URL =
  process.env.PIPELINE_REPO_RAW_URL ||
  "https://raw.githubusercontent.com/NCrutzen/orqai-agent-pipeline/main";

const ORQ_ROUTER_URL = "https://api.orq.ai/v2/router/chat/completions";

/**
 * Run the prompt adapter for a given pipeline stage.
 *
 * @param stage - The stage machine name (e.g., "architect", "researcher")
 * @param context - Key-value pairs of context data (useCase, blueprint, etc.)
 * @returns The text response from Claude
 */
export async function runPromptAdapter(
  stage: string,
  context: Record<string, string>
): Promise<string> {
  const stageConfig = getStageByName(stage);
  if (!stageConfig) {
    const err = new Error(`Unknown pipeline stage: ${stage}`);
    (err as unknown as Record<string, unknown>).code = "GITHUB_NOT_FOUND";
    throw err;
  }

  // Fetch .md file content from GitHub
  const url = getStageUrl(stageConfig);
  const response = await fetch(url);

  if (!response.ok) {
    const err = new Error(
      `Failed to fetch pipeline template: ${response.status} ${response.statusText}`
    );
    (err as unknown as Record<string, unknown>).code =
      response.status === 404 ? "GITHUB_NOT_FOUND" : "GITHUB_FETCH_FAILED";
    throw err;
  }

  const raw = await response.text();

  // Strip YAML frontmatter
  const { content: rawContent } = matter(raw);

  // Resolve <files_to_read> references — fetch and inline each referenced file
  const systemPrompt = await resolveFileReferences(rawContent);

  // Build user message with XML-tagged context
  const userMessage = buildUserMessage(context);

  // Call Claude via Orq.ai router
  const apiKey = process.env.ORQ_API_KEY;
  if (!apiKey) {
    const err = new Error("ORQ_API_KEY environment variable is not set");
    (err as unknown as Record<string, unknown>).code = "ORQ_AUTH";
    throw err;
  }

  const result = await fetch(ORQ_ROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!result.ok) {
    const body = await result.text();
    const err = new Error(
      `Orq.ai router error: ${result.status} ${result.statusText} — ${body}`
    );
    (err as unknown as Record<string, unknown>).code =
      result.status === 401 ? "ORQ_AUTH" : "ORQ_ERROR";
    throw err;
  }

  const json = await result.json();
  return json.choices?.[0]?.message?.content ?? "";
}

/**
 * Parse <files_to_read> block from .md content, fetch each referenced file
 * from GitHub, and replace the block with inlined file contents.
 *
 * Example input:
 *   <files_to_read>
 *   - orq-agent/references/naming-conventions.md
 *   - orq-agent/systems.md
 *   </files_to_read>
 *
 * Becomes:
 *   <reference_files>
 *   <file path="orq-agent/references/naming-conventions.md">
 *   ...file content...
 *   </file>
 *   ...
 *   </reference_files>
 */
async function resolveFileReferences(content: string): Promise<string> {
  const match = content.match(/<files_to_read>([\s\S]*?)<\/files_to_read>/);
  if (!match) return content;

  // Parse file paths from the bullet list
  const paths = match[1]
    .split("\n")
    .map((line) => line.replace(/^[\s-]+/, "").trim())
    .filter(Boolean);

  if (paths.length === 0) return content;

  // Fetch all referenced files in parallel
  const fetched = await Promise.all(
    paths.map(async (filePath) => {
      try {
        const res = await fetch(`${PIPELINE_REPO_RAW_URL}/${filePath}`);
        if (!res.ok) return { path: filePath, content: `[Failed to load: ${res.status}]` };
        const text = await res.text();
        // Strip frontmatter from referenced files too
        const { content: body } = matter(text);
        return { path: filePath, content: body.trim() };
      } catch {
        return { path: filePath, content: "[Failed to load]" };
      }
    })
  );

  // Build inlined reference block
  const inlined = fetched
    .map((f) => `<file path="${f.path}">\n${f.content}\n</file>`)
    .join("\n\n");

  // Replace the <files_to_read> block with inlined content
  return content.replace(
    /<files_to_read>[\s\S]*?<\/files_to_read>/,
    `<reference_files>\n${inlined}\n</reference_files>`
  );
}

/**
 * Format context key-value pairs as XML tags for the user message.
 *
 * Example output:
 * <use_case>Process incoming invoices...</use_case>
 * <blueprint>Architecture blueprint here...</blueprint>
 */
function buildUserMessage(context: Record<string, string>): string {
  return Object.entries(context)
    .map(([key, value]) => {
      // Convert camelCase to snake_case for XML tag names
      const tagName = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      return `<${tagName}>${value}</${tagName}>`;
    })
    .join("\n");
}
