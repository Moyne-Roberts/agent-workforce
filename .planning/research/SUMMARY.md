# Project Research Summary

**Project:** V5.0 Browser Automation — Playwright Script Generation, VPS-hosted MCP Server, Script Deployment Pipeline, Agent Spec Wiring
**Domain:** Browser automation integration for AI agent design pipeline
**Researched:** 2026-03-03
**Confidence:** HIGH

## Executive Summary

V5.0 extends the existing Orq Agent Designer pipeline with deterministic browser automation for business systems (NXT, iController, Intelly) that have no API. The well-established approach is to generate fixed Playwright TypeScript scripts that encapsulate complete business workflows, host them on a VPS as a custom MCP server exposing workflow-level tools (not generic browser primitives), and wire agent specs to call those tools via Streamable HTTP. This is the correct abstraction: an agent calls `nxt-lookup-customer` and receives structured data — it never orchestrates individual browser actions. This keeps agents simple, costs 4x fewer tokens than dynamic browser-use, and is fully deterministic.

The recommended stack adds exactly three new concerns to an otherwise pure Node.js/TypeScript project: Playwright 1.58.x for browser automation, `@modelcontextprotocol/sdk` 1.27.x for the MCP server framework, and PM2 for process management on the VPS. The existing deployment model (git-based, `@orq-ai/node` for agent management) is unchanged. The pipeline gains one new subagent (`playwright-script-generator`) and one new command (`deploy-scripts`), plus a central reference file (`app-capabilities.json`) that all new pipeline stages read from.

The most critical risk is deploying the pipeline before real DOM context (selector inventories, Playwright codegen recordings) exists for each target system — LLMs will hallucinate plausible-looking selectors that fail on first execution. The mitigation is mandatory: `app-capabilities.json` must capture verified DOM context per target system, not just "this system needs browser automation." Security is the second critical risk: the VPS MCP server holds authenticated sessions to internal business systems and must never be deployed without TLS, bearer token auth, and audit logging in place. Both risks are architectural decisions that must be settled in Phase 1 and Phase 3 respectively — they cannot be bolted on later.

## Key Findings

### Recommended Stack

V5.0 adds a VPS as the first separate server in the stack — this is an infrastructure milestone, not just a code change. Playwright 1.58.x on Node.js 22.x LTS is the clear choice: Microsoft-maintained, de facto standard for deterministic browser scripting, and Chromium-only mode keeps VPS footprint under control. The `@modelcontextprotocol/sdk` 1.27.x with Streamable HTTP transport is the correct MCP server approach — SSE is deprecated, stdio requires local process access, and Streamable HTTP is the production standard for remote MCP servers. Microsoft's `@playwright/mcp` package is explicitly NOT the right tool: it exposes 26 generic browser primitives, costs 4x more tokens, and is non-deterministic. A thin custom MCP server exposing 3-5 workflow-level tools per business system is the right abstraction.

**Core technologies:**
- **Playwright `^1.58.0`**: Headless Chromium automation on VPS — de facto standard, Chromium-only mode saves 1GB+ disk vs multi-browser
- **`@modelcontextprotocol/sdk` `^1.27.0`**: MCP server framework with Streamable HTTP transport — official SDK, SSE deprecated in MCP spec 2025-03-26
- **Node.js `22.x LTS`**: VPS runtime — Playwright 1.58 requirement; matches development environment
- **Express `^4.21.0`**: HTTP server wrapping MCP Streamable HTTP middleware — simplest integration path for remote MCP servers
- **PM2 `^6.0.0`**: VPS process management — log rotation, auto-restart, ecosystem config; simpler than Docker for a single Node.js process
- **Zod `^3.24.0`**: MCP tool input schema validation — required by MCP SDK for all tool definitions
- **Winston `^3.17.0`**: Structured file logging — required because MCP stdio transport conflicts with `console.log`

### Expected Features

The feature space divides cleanly into three tiers. The MVP (P0) is the full end-to-end pipeline for one system (NXT): capabilities config, detection, script generation, VPS MCP server, deployment, and agent spec wiring. Differentiators (P1-P2) add codegen integration, script self-testing, versioning, and health monitoring — improving reliability without blocking the MVP. Everything involving dynamic/exploratory browser-use is an explicit anti-feature: it already exists in Orq.ai and duplicating it adds maintenance burden without user value.

**Must have (table stakes):**
- **Application capabilities config (`app-capabilities.json`)** — foundation; every other feature reads from it; must include verified DOM context per system
- **Browser-use detection during spec generation** — pipeline auto-detects when a use case touches a browser-only system; unknown systems trigger discussion step fallback
- **Playwright script generation (parameterized, TypeScript, headless-compatible)** — core deliverable; scripts export typed functions matched to MCP tool schemas
- **VPS MCP server exposing scripts as workflow-level tools** — single server for all systems, namespaced (`nxt-*`, `icontroller-*`); Streamable HTTP transport; bearer token auth
- **Automated script deployment** — git-based recommended for audit trail; non-technical users must never need terminal access
- **Agent spec wiring with MCP tool references** — tool resolver extended with "browser" resolution path; Orq.ai-native MCP tool configs

**Should have (differentiators):**
- **Codegen recording integration** — record real selectors via `npx playwright codegen [url]` before LLM generates scripts; dramatically reduces hallucinated selectors
- **Script self-test before deployment** — run generated script against target system in test mode before VPS deployment
- **Script versioning and rollback** — git-based deployment provides this for free
- **Script health monitoring** — scheduled canary checks per deployed script; alerts on failure

**Defer (v2+):**
- Second system validation (iController or Intelly) — Phase 5, after NXT pipeline is proven
- Dashboard/status indicator for script health — useful but not required for initial pipeline
- Async script execution with task IDs — only needed at high concurrency (>5 requests/minute)
- Dynamic/exploratory browser-use — already solved by existing Orq.ai MCP tools; do not duplicate

### Architecture Approach

The pipeline is extended, not replaced. V5.0 inserts new stages into the existing discussion → architect → tool resolver → wave sequence: a browser-use detection substep in Step 2, a `browser_automation` flag carried through the blueprint, a new "browser" resolution path in the tool resolver, a new Wave 2.5 for Playwright script generation, and a new `deploy-scripts` command that runs after wave generation. The foundational reference file (`app-capabilities.json`) is the single source of truth for system integration methods, base URLs, auth patterns, known flows, and DOM context — analogous to how `tool-catalog.md` serves the existing tool resolver. All target system credentials live exclusively on the VPS; the pipeline never handles passwords.

**Major components:**
1. **`app-capabilities.json`** — reference file mapping systems to integration method, auth patterns, known flows, and verified DOM context; read by discussion step, architect, and script generator
2. **`playwright-script-generator.md` (subagent)** — Wave 2.5 subagent generating TypeScript Playwright scripts from agent specs and system config; enforces POM pattern, structured outputs, typed function exports
3. **VPS MCP Server** — Node.js/Express server exposing workflow-level MCP tools via Streamable HTTP; single server for all systems with session pool for Chromium contexts and hot-reload for script deployment
4. **`/orq-agent:deploy-scripts` (command)** — pushes generated scripts to VPS and registers them as MCP tools; git-based deployment recommended for audit trail and rollback
5. **Browser-use detection (Discussion step enhancement)** — consults capabilities config; unknown systems trigger user questions; produces `browser_automation: true` flags per agent in blueprint

### Critical Pitfalls

1. **Hallucinated selectors in LLM-generated scripts** — LLMs cannot access live DOM and will guess selectors that look correct but target nonexistent elements. Prevention: `app-capabilities.json` must include selector inventories or Playwright codegen recordings per target system; never generate scripts from description alone.
2. **Brittle selectors breaking on every UI update** — enterprise systems ship UI changes without warning; CSS-chained selectors fail silently. Prevention: enforce POM architecture and selector priority hierarchy (`getByRole` > `getByLabel` > `getByText` > `data-testid` > CSS as last resort) in the script generator template from day one.
3. **VPS MCP server deployed without proper authentication** — server holds authenticated sessions to internal business systems; 88% of MCP servers rely on insecure static secrets (Astrix Security 2025). Prevention: TLS, bearer token auth, rate limiting, and audit logging must be designed before first deployment.
4. **Target system credentials leaked or mismanaged** — credentials in git history, agent spec variables, or Orq.ai platform logs are day-zero security failures. Prevention: credentials on VPS only as environment variables; `storageState` files on tmpfs; dedicated service accounts per system with rotation; MCP tools accept business identifiers, never passwords.
5. **No maintenance loop — scripts degrade silently** — target UIs change; without health checks, agents silently return stale or empty data. Prevention: scheduled canary checks per deployed script; alert within 1 hour of failure; design health architecture in Phase 2 even if implementation is Phase 5.
6. **Wrong MCP tool granularity** — exposing Playwright primitives as MCP tools (`browser_click`, `browser_navigate`) creates fragile, token-expensive agent loops. Prevention: all MCP tools must be workflow-level business actions (`nxt-create-invoice`); no generic browser primitives, ever.

## Implications for Roadmap

The dependency graph is clear: the capabilities config must exist before detection logic, scripts cannot be generated without detection output, the VPS server must exist before deployment, and agent spec wiring cannot happen until tools are registered. This produces a natural 5-phase structure that maps directly to the feature research MVP definition and the architecture build-order recommendation.

### Phase 1: Foundation — Capabilities Config and VPS Scaffold

**Rationale:** Everything else reads from `app-capabilities.json`. The VPS MCP server scaffold (with health-check tool only) must exist to validate the infrastructure approach before the pipeline is touched. Doing this first prevents building pipeline logic against a capabilities config schema that will change. Security architecture (TLS, bearer token auth) must be settled here, not retrofitted.

**Delivers:** `app-capabilities.json` with NXT entry (including real DOM context from Playwright codegen recordings), VPS MCP server scaffold with Streamable HTTP transport and bearer token auth, manual NXT login script proven working end-to-end.

**Addresses:** Capabilities config (table stakes), POM architecture standard, multi-system detection foundation

**Avoids:** Hallucinated selectors (DOM context captured here), enterprise SSO surprises (auth method validated per system), security shortcuts (VPS deployed with proper auth from day one)

### Phase 2: Script Generation

**Rationale:** With verified DOM context in the config and the VPS server running, the script generator can produce scripts that actually work. The interface contract (typed function export format) must be settled in this phase because both the generator and the VPS server depend on it. POM architecture and selector hierarchy must be enforced in the generator template from day one — not added as a retrofit.

**Delivers:** `playwright-script-generator.md` subagent, TypeScript script template (POM architecture, error handling, parameterized inputs, structured JSON output), script interface contract, generated scripts for all NXT flows in capabilities config.

**Uses:** Playwright 1.58, TypeScript, Zod schemas, `app-capabilities.json` DOM context

**Implements:** Script generator subagent pattern, script interface contract, POM architecture enforcement

**Avoids:** Brittle selectors (POM enforced from generation), wrong tool granularity (scripts export one complete workflow function)

### Phase 3: Pipeline Integration

**Rationale:** Pipeline modifications (discussion step, architect, tool resolver, orchestrator) should happen after the script generation approach is proven, so integration points are built against a stable interface. The tool catalog update and VPS security design belong here since the pipeline is where those choices become concrete.

**Delivers:** Browser-use detection in Discussion step (Step 2), `browser_automation` flag in architect blueprint, tool resolver "browser" resolution path, orchestrator Wave 2.5 for Playwright script generation, `tool-catalog.md` updated with VPS MCP server entry.

**Implements:** Discussion step enhancement, architect blueprint enhancement, tool resolver browser path, orchestrator Wave 2.5

**Avoids:** Pipeline ordering violations (deployment enforced before wiring)

### Phase 4: Deployment and Agent Spec Wiring

**Rationale:** Once the pipeline generates scripts and the VPS server is running, the deployment bridge and spec wiring are the integration points that complete the end-to-end flow. These are tightly coupled — the deploy-scripts command must succeed before spec wiring can reference real tool IDs.

**Delivers:** `/orq-agent:deploy-scripts` command (git-based deployment to VPS), VPS management tools (`deploy-script`, `list-scripts`, `remove-script`), agent spec wiring with MCP tool references, full NXT end-to-end validation.

**Uses:** Streamable HTTP deployment, MCP meta-tool pattern, existing deployer extended with script pre-deployment

**Avoids:** Spec wiring before deployment (pipeline ordering enforced), manual SSH/SCP deployment (pipeline handles everything)

### Phase 5: Hardening and Second System

**Rationale:** After NXT end-to-end is proven, harden the pipeline before expanding to additional systems. Script health monitoring and canary checks must exist before adding iController or Intelly to catch regressions early. The second system validates that the architecture generalizes.

**Delivers:** Script self-test before deployment, script health monitoring (scheduled canary checks), versioning and rollback (git-based), alerting on script failures, second system (iController) added to capabilities config and validated.

**Avoids:** Silent script degradation (health checks running for every deployed script), no maintenance loop

### Phase Ordering Rationale

- VPS scaffold and capabilities config come first because they are blocking dependencies for all later phases; the MCP transport choice (Streamable HTTP) and security architecture (bearer token, TLS) must be settled before the pipeline expects them.
- Script generation precedes pipeline integration because building pipeline hooks before validating the generator output risks building the wrong integration points.
- Deployment and wiring are a single phase because they are tightly coupled — the `deploy-scripts` command must succeed before spec wiring can reference real VPS tool IDs.
- Hardening and second system are last because they validate that the architecture generalizes; expanding to iController before the NXT pipeline is proven would obscure which system caused failures.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1:** Enterprise SSO handling for iController (Azure AD SSO may block service account login; needs verified workaround before adding iController to capabilities config)
- **Phase 3:** Orq.ai MCP tool registration API (confirm how `tool_id` placeholders get resolved into real IDs after VPS registration; spec wiring depends on this)
- **Phase 5:** iController and Intelly UI patterns (canvas-based UI in Intelly likely requires headed browser with Xvfb; needs validation before scripting)

Phases with standard patterns (skip `/gsd:research-phase`):

- **Phase 2:** Playwright script generation patterns are well-documented; POM architecture and selector hierarchy are established best practices with clear documentation
- **Phase 4:** Git-based deployment is the recommended approach with clear precedent; MCP management tools follow the same pattern as automation tools

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Playwright and MCP SDK versions verified against npm registry on 2026-03-03; Streamable HTTP transport verified against MCP spec 2025-03-26; PM2 and Express are stable, well-known packages |
| Features | MEDIUM | Core features (capabilities config, script generation, VPS MCP server, deployment, wiring) are well-understood. The end-to-end pipeline integration has no direct precedent — novel combination of established patterns |
| Architecture | HIGH | Architecture derived from existing codebase analysis plus verified external research; key decisions (Streamable HTTP, single VPS, credentials on VPS only, workflow-level tools) all have HIGH-confidence rationale |
| Pitfalls | HIGH | Playwright, MCP security, and LLM code generation all have extensive community experience; pitfalls are well-documented with specific statistics (88% credential reliance, 4x token overhead, 40-60% QA selector maintenance cost) |

**Overall confidence:** HIGH

### Gaps to Address

- **Real DOM context for target systems:** Playwright codegen recordings against live NXT, iController, and Intelly must be captured before script generation begins. This requires a human to run `npx playwright codegen [url]` against each system. Plan for this in Phase 1 before any LLM-generated scripts are attempted.
- **iController SSO auth method:** Architecture notes iController uses Azure AD SSO. Whether service accounts can bypass SSO or require pre-auth session approaches is unknown and must be validated in Phase 1 capabilities config work.
- **Intelly canvas-based UI:** Architecture flags Intelly as requiring headed browser (not headless) due to canvas elements. This changes VPS requirements (Xvfb display server). Validate before adding Intelly to any phase roadmap.
- **Orq.ai MCP tool ID resolution:** How `tool_id` values returned by the VPS after script registration flow back into Orq.ai agent specs needs confirmation. The existing tool resolver uses placeholder `{{TOOL_ID}}` values — verify this mechanism works for dynamically registered VPS tools before Phase 4.
- **VPS provider and HTTPS setup:** Research recommends Let's Encrypt with certbot or Nginx reverse proxy for TLS. VPS provider is not selected; this must be decided in Phase 1 before security architecture is finalized.

## Sources

### Primary (HIGH confidence)

- [Playwright npm registry](https://www.npmjs.com/package/playwright) — Version 1.58.2 confirmed 2026-03-03
- [Playwright release notes](https://playwright.dev/docs/release-notes) — Node.js 20/22/24 runtime requirement
- [@modelcontextprotocol/sdk npm registry](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — Version 1.27.1 confirmed 2026-03-03
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) — McpServer API, Streamable HTTP transport
- [MCP Specification - Transports](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — Streamable HTTP as replacement for deprecated SSE
- [Playwright Official Best Practices](https://playwright.dev/docs/best-practices) — Selector strategy, POM architecture
- [OWASP: Practical Guide for Secure MCP Server Development](https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/) — MCP-specific security controls
- [Anthropic: Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) — On-demand tool loading, filesystem-based tool discovery
- [PM2 documentation](https://pm2.keymetrics.io/) — Process management features
- Orq.ai Agent Fields Reference (local: `orq-agent/references/orqai-agent-fields.md`) — MCP tool type field verification

### Secondary (MEDIUM confidence)

- [MCP Hosting Guide 2026](https://www.agent37.com/blog/mcp-hosting-complete-guide-to-hosting-mcp-servers) — VPS deployment patterns; consistent with official docs
- [Cloudflare Browser Rendering token cost comparison](https://developers.cloudflare.com/browser-rendering/playwright/playwright-mcp/) — 114K vs 27K token comparison for generic vs scripted tools
- [Microsoft Playwright MCP GitHub](https://github.com/microsoft/playwright-mcp) — Confirmed generic tool abstraction and why it is wrong for V5.0
- [Speakeasy: Playwright Tool Proliferation Problem](https://www.speakeasy.com/blog/playwright-tool-proliferation) — 26-tool overhead analysis
- [Astrix: State of MCP Server Security 2025](https://astrix.security/learn/blog/state-of-mcp-server-security-2025/) — 88% credential reliance, 8.5% OAuth adoption statistics
- [Checkly: Generating E2E Tests with AI and Playwright MCP](https://www.checklyhq.com/blog/generate-end-to-end-tests-with-ai-and-playwright/) — LLM hallucination in script generation
- [Stagehand vs Browser Use vs Playwright (2026)](https://www.nxcode.io/resources/news/stagehand-vs-browser-use-vs-playwright-ai-browser-automation-2026) — Deterministic Playwright 10x faster than AI browser-use
- [Orq.ai MCP Documentation](https://docs.orq.ai/docs/common-architecture/mcp) — `connection_type: "http"` compatibility with Streamable HTTP
- [BrowserStack: Playwright Selector Best Practices 2026](https://www.browserstack.com/guide/playwright-selectors-best-practices) — Selector reliability patterns
- [WorkOS: Complete Guide to MCP Security](https://workos.com/blog/mcp-security-risks-best-practices) — OAuth, mTLS, token binding for remote MCP servers

---
*Research completed: 2026-03-03*
*Ready for roadmap: yes*
