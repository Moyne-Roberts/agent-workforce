# Feature Research: V5.0 Browser Automation

**Domain:** Browser automation pipeline for AI agents -- Playwright script generation, MCP server tool exposure, capability detection, deployment automation
**Researched:** 2026-03-03
**Confidence:** MEDIUM -- Playwright MCP is well-documented (Microsoft official, Docker images available). Script generation from LLM prompts is an established pattern. Custom MCP server exposure is well-understood via MCP spec. The novel part is the end-to-end pipeline integration (detect need, generate script, deploy to VPS, wire agent spec) which has no direct precedent.

## Context: What Already Exists

**Existing Pipeline (V1.0-V2.0):** Agent design from natural language, discussion step for gray areas, architect with complexity gate, spec generator (18 Orq.ai fields), tool resolver with unified catalog (MCP-first), deploy/test/iterate/harden pipeline.

**Tool Resolver:** Already resolves capabilities to MCP tools, HTTP tools, function tools, and code tools. Uses a curated catalog (`tool-catalog.md`) with web search fallback. All MCP tools use HTTP transport (`connection_type: "http"`). The tool resolver already generates Orq.ai-native MCP tool configs with `server_url` and `connection_type` fields.

**Existing MCP Pattern:** Agents reference MCP tools via `{ "type": "mcp", "tool_id": "{{TOOL_ID}}" }`. MCP servers are registered in Orq.ai Studio with a `server_url` pointing to the HTTP endpoint. This pattern is already proven in V2.0.

**Out of Scope (already handled):** Dynamic/exploratory browser-use -- Orq.ai already has MCP tools for this. V5.0 is specifically for fixed, deterministic Playwright scripts for known workflows.

**V5.0 Target:** At least one real system (NXT) working end-to-end: pipeline detects browser automation need, generates Playwright script, deploys to VPS, wires agent spec with MCP tool reference.


## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Dependency on Existing | Notes |
|---------|--------------|------------|----------------------|-------|
| Application capabilities config file | Pipeline must know which systems have APIs vs need browser automation. Without this, every system requires a discussion step. | LOW | New file in `orq-agent/references/` alongside `tool-catalog.md` | JSON/YAML file mapping system names to integration methods: `"nxt": { "method": "browser", "url": "https://nxt.example.com", "auth": "form-login", "flows": ["lookup-customer", "create-invoice"] }`. One entry per system. Loaded by spec generator and tool resolver. |
| Browser-use detection during spec generation | When an agent needs to interact with a browser-only system, the pipeline must detect this automatically -- not require the user to specify it. | MEDIUM | Discussion step (fallback for unknown systems) + spec generator + capabilities config | Two-pass detection: (1) match system names in use case against capabilities config, (2) if system not in config, discussion step asks user "Does [system] have an API or is it browser-only?" Result flows to architect and tool resolver. |
| Playwright script generation for deterministic flows | The core deliverable. Generate working Playwright scripts for login, navigate, extract data, fill forms on known systems. | HIGH | Capabilities config (system URLs, auth patterns, available flows) | LLM generates Playwright TypeScript based on: system URL, auth method, flow description (e.g., "lookup customer by account number, extract balance and last payment date"). Output: self-contained `.ts` file with login, navigation, action, and data extraction. Uses `getByRole`/`getByLabel`/`getByTestId` locators (Playwright best practice). Includes error handling and timeout configuration. |
| VPS-hosted MCP server exposing scripts as tools | Agents need to call browser automation via standard MCP tool interface. The MCP server wraps Playwright scripts and exposes them as individual tools. | HIGH | Script generation output + VPS infrastructure | Custom MCP server (Node.js/TypeScript) that: (1) loads Playwright scripts from a directory, (2) exposes each script as an MCP tool with typed input/output schema, (3) runs scripts in headless Chromium, (4) returns structured results. Uses HTTP transport (Orq.ai requirement). Each script becomes a tool: `nxt-lookup-customer`, `nxt-create-invoice`, etc. |
| Automated script deployment to VPS | New scripts must reach the VPS without manual SSH/SCP. Non-technical users cannot be expected to deploy scripts. | MEDIUM | VPS-hosted MCP server + deployment mechanism | Deploy via MCP tool call to the VPS server itself: a `deploy-script` meta-tool that accepts script content and registers it. Alternative: git-based deployment (push to repo, VPS pulls). MCP-based deployment is simpler for the pipeline. |
| Agent spec wiring with MCP tool references | Generated agent specs must include the correct MCP tool references so deployed agents can call browser automation scripts. | MEDIUM | Tool resolver + MCP server URL + script tool names | Extend tool resolver to: (1) detect browser automation needs from capabilities config, (2) generate MCP tool config pointing to VPS server, (3) include specific tool references in agent spec. Config: `{ "type": "mcp", "tool_id": "{{NXT_BROWSER_MCP_TOOL_ID}}" }` with `server_url` pointing to VPS. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Dependency on Existing | Notes |
|---------|-------------------|------------|----------------------|-------|
| Flow recording via Playwright codegen integration | Instead of LLM-guessing UI flows, record actual user interactions with `npx playwright codegen [url]` and use the recording as a template for script generation. Dramatically improves accuracy for complex UIs. | MEDIUM | Playwright CLI available on dev machine | Two-path script generation: (1) LLM-generated from flow description (default), (2) codegen-recorded and LLM-refined (when available). Codegen output is treated as a draft -- LLM cleans up selectors, adds error handling, parameterizes inputs. This is the established best practice: "treat codegen as a draft, not final code." |
| Script self-test before deployment | Generated scripts run against the target system in a test mode before being deployed. Catches broken selectors, auth failures, missing elements early. | MEDIUM | VPS with Playwright runtime + test system access | After generation, run script with test inputs. If it passes: deploy. If it fails: LLM diagnoses the failure (screenshot + error), regenerates the problematic section. Mirrors V2.0's iterate pattern but for browser scripts instead of agent prompts. |
| Script versioning and rollback | Track script versions on the VPS. If a new version breaks (system UI changed), roll back to the previous working version. | LOW | VPS deployment mechanism | Simple: deploy scripts with version suffix (`nxt-lookup-customer-v2.ts`). MCP server loads latest version. Rollback = point to previous version. Git-based deployment gets this for free. |
| Parameterized script templates | Scripts accept runtime parameters (customer ID, invoice number) rather than hardcoding values. Enables one script to serve multiple agent calls. | LOW | Script generation prompt engineering | Scripts export a function: `async function lookupCustomer(params: { accountNumber: string }): Promise<CustomerData>`. MCP server maps tool input schema to function parameters. This is table stakes for reusability but listed as differentiator because the naive approach (one script per exact flow) is simpler to build first. |
| Multi-system capability detection | Config file supports multiple systems with different integration methods. Pipeline handles mixed swarms (some agents use APIs, some use browser, some use both). | LOW | Capabilities config file | Config example: `{ "nxt": { "method": "browser" }, "orq": { "method": "api" }, "intelly": { "method": "browser" } }`. Tool resolver routes each agent to the right integration method. Already implicit in the tool resolver's resolution chain -- this just adds the "browser" path. |
| Script health monitoring via MCP | VPS MCP server exposes a `health-check` tool that runs all scripts in test mode and reports which are passing/failing. Enables proactive maintenance when UIs change. | MEDIUM | VPS MCP server + test fixtures per script | Each script has a lightweight smoke test (login, check one known element). Health check runs all smoke tests, returns status per script. Agents or the pipeline can call this before relying on a script. |

### Anti-Features (Do NOT Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Dynamic/exploratory browser-use in generated scripts | "What if the agent needs to explore a page it has not seen before?" | Already solved by existing Orq.ai MCP tools for dynamic browser-use. Building a second dynamic browser engine creates redundancy and maintenance burden. V5.0 scope is explicitly fixed/deterministic scripts. | Use existing Orq.ai browser-use MCP tools for dynamic scenarios. V5.0 scripts handle known, repeatable flows only. |
| Visual screenshot-based interaction | "Use screenshots to understand the page like a human would." | Screenshot-based approaches (pixel coordinates, image recognition) are slower, less reliable, and more expensive (vision model tokens) than accessibility tree / DOM-based interaction. Microsoft's Playwright MCP deliberately chose accessibility tree over screenshots. | Use Playwright's accessibility tree and structured selectors (`getByRole`, `getByLabel`). Faster, deterministic, and cheaper. |
| Browser automation for every system upfront | "Map all Moyne Roberts systems at once." | Premature. Each system has unique auth flows, UI patterns, and page structures. Trying to generate scripts for all systems before validating the pipeline on one creates risk of building the wrong abstraction. | Start with NXT (one real system). Validate the full pipeline. Then add iController, Intelly one at a time. Each system addition is incremental. |
| Self-healing scripts that adapt to UI changes automatically | "Scripts should detect when the UI changed and fix themselves." | Requires runtime LLM calls during script execution, which adds latency, cost, and unpredictability to what should be deterministic flows. Also masks UI changes that may need human attention (e.g., new required fields). | Script health monitoring detects failures. LLM regeneration fixes broken scripts as a separate step with human oversight. Deterministic execution, intelligent maintenance. |
| Headed browser mode for agents | "Show the browser so users can watch the agent work." | VPS runs headless for performance and reliability. Headed mode requires display server, adds resource overhead, creates security concerns (screen recording of potentially sensitive data). Non-technical users do not benefit from watching Playwright run. | Return structured results from scripts (data extracted, actions taken). Log screenshots at key steps for debugging. VPS stays headless. |
| Building a custom Playwright MCP from scratch | "Build our own Playwright MCP server like Microsoft's." | Microsoft's Playwright MCP exposes 25+ generic browser tools. This is the wrong abstraction -- agents do not need generic "click element X" tools, they need domain-specific tools like "lookup customer in NXT." Generic browser tools create the tool proliferation problem (26 tools per agent). | Build a thin custom MCP server that exposes domain-specific scripts as individual tools with typed schemas. Each tool does one complete workflow, not one browser action. |


## Feature Dependencies

```
[Capabilities Config File]
    |
    +---> [Browser-Use Detection] (reads config during spec generation)
    |         |-- requires --> Capabilities config
    |         |-- fallback --> Discussion step (for unknown systems)
    |         |-- produces --> Browser automation flags per agent
    |
    +---> [Playwright Script Generation] (uses config for system details)
    |         |-- requires --> Capabilities config (URL, auth, flows)
    |         |-- requires --> Browser-use detection output (which agents need scripts)
    |         |-- optional --> Codegen recording (improves accuracy)
    |         |-- produces --> .ts script files per flow
    |
    +---> [VPS MCP Server] (hosts and exposes scripts)
    |         |-- requires --> Server implementation (Node.js + Playwright runtime)
    |         |-- requires --> Script files to load
    |         |-- produces --> MCP HTTP endpoint with per-script tools
    |
    +---> [Script Deployment] (gets scripts to VPS)
    |         |-- requires --> VPS MCP server running
    |         |-- requires --> Generated script files
    |         |-- produces --> Scripts registered on VPS as MCP tools
    |
    +---> [Agent Spec Wiring] (connects agents to MCP tools)
              |-- requires --> VPS MCP server URL
              |-- requires --> Tool names from deployed scripts
              |-- extends --> Existing tool resolver
              |-- produces --> Agent specs with MCP tool references
```

### Dependency Notes

- **Capabilities config is the foundation**: Everything else reads from it. Must be built first. Analogous to how the ecosystem map was foundational for V4.0.
- **Script generation and VPS server are independently buildable**: Script generation produces files; the VPS server consumes files. They can be developed in parallel as long as the file format (script interface) is agreed.
- **Deployment bridges generation and serving**: Cannot test end-to-end without deployment working. This is the integration point.
- **Agent spec wiring is the last mile**: Depends on everything else being functional. But the tool resolver extension is low complexity because the MCP pattern already exists.
- **Codegen recording enhances but does not block**: LLM-only script generation works without recordings. Recordings improve accuracy but require someone to run the Playwright codegen CLI.


## MVP Definition

### Phase 1: Foundation (Capabilities Config + Detection)

- [ ] **Application capabilities config file** -- JSON file in `orq-agent/references/` mapping systems to integration methods (API/browser/headed). Start with NXT entry.
- [ ] **Browser-use detection in spec generator** -- Spec generator reads config, flags agents that need browser automation. Unknown systems trigger discussion step.
- [ ] **Capabilities config schema** -- Typed schema for config entries: system name, method, base URL, auth type, available flows with descriptions.

### Phase 2: Script Generation + VPS Server

- [ ] **Playwright script generation** -- LLM generates TypeScript Playwright scripts from flow descriptions in capabilities config. Parameterized inputs, structured outputs, error handling.
- [ ] **VPS MCP server implementation** -- Node.js MCP server that loads scripts from a directory, exposes each as a typed tool, runs in headless Chromium. HTTP transport.
- [ ] **Script interface contract** -- Define the standard script export format (async function with typed params/return), so generation and server agree on the interface.

### Phase 3: Deployment + Wiring

- [ ] **Automated script deployment** -- Pipeline deploys generated scripts to VPS via MCP tool call or git push.
- [ ] **Agent spec wiring** -- Tool resolver extended with "browser" resolution path. Generates MCP tool configs pointing to VPS server for browser-automated flows.
- [ ] **End-to-end validation with NXT** -- One complete flow: user describes use case involving NXT, pipeline detects browser need, generates script, deploys, wires agent spec.

### Phase 4: Hardening (Post-Validation)

- [ ] **Script self-test before deployment** -- Run generated scripts against target system before deploying.
- [ ] **Script versioning and rollback** -- Track versions, enable rollback on failure.
- [ ] **Script health monitoring** -- MCP tool that runs smoke tests on all deployed scripts.
- [ ] **Second system (iController or Intelly)** -- Validate the pipeline generalizes beyond NXT.


## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| Capabilities config file | HIGH (blocker) | LOW | P0 | 1 |
| Browser-use detection | HIGH (blocker) | MEDIUM | P0 | 1 |
| Playwright script generation | HIGH (core) | HIGH | P0 | 2 |
| VPS MCP server | HIGH (core) | HIGH | P0 | 2 |
| Script interface contract | HIGH (blocker) | LOW | P0 | 2 |
| Automated script deployment | HIGH (core) | MEDIUM | P0 | 3 |
| Agent spec wiring | HIGH (core) | MEDIUM | P0 | 3 |
| End-to-end NXT validation | HIGH | MEDIUM | P0 | 3 |
| Parameterized script templates | HIGH | LOW | P1 | 2 |
| Multi-system capability detection | MEDIUM | LOW | P1 | 1 |
| Codegen recording integration | MEDIUM | MEDIUM | P2 | 2+ |
| Script self-test | MEDIUM | MEDIUM | P2 | 4 |
| Script versioning/rollback | MEDIUM | LOW | P2 | 4 |
| Script health monitoring | MEDIUM | MEDIUM | P3 | 4 |
| Second system validation | HIGH | MEDIUM | P3 | 4 |

**Priority key:**
- P0: Must have for V5.0 -- the end-to-end pipeline for one system
- P1: Should have -- improves reliability and reusability
- P2: Add after validation -- hardening and developer experience
- P3: Polish -- monitoring, additional systems


## Competitor / Adjacent Tool Analysis

| Feature | Microsoft Playwright MCP | Browser-Use MCP | Promptwright | Custom VPS MCP (V5.0) |
|---------|------------------------|-----------------|-------------|----------------------|
| Tool exposure | 25+ generic browser tools (click, type, navigate, snapshot) | Dynamic browser-use with LLM reasoning | Natural language to Playwright scripts | Domain-specific tools per workflow (e.g., `nxt-lookup-customer`) |
| Interaction model | Accessibility tree-based (fast, deterministic) | Screenshot + accessibility hybrid | Generated scripts | Accessibility tree via Playwright (deterministic scripts) |
| Use case | AI agents that need generic browser control | Exploratory browser automation | Test automation from prompts | Fixed workflows for known business systems |
| Deployment | Local or Docker container | Local Python server | CLI tool | VPS-hosted, HTTP MCP endpoint |
| Agent integration | Direct MCP tool calls (26 tools per request) | MCP tool calls | Script output (not MCP) | MCP tool calls (1 tool per workflow) |
| Context overhead | HIGH (26 tool schemas per request) | MEDIUM (fewer tools, more LLM calls) | N/A (offline generation) | LOW (3-5 domain tools per agent) |

**Key insight from ecosystem research:** Microsoft's Playwright MCP exposes every browser action as a separate tool, creating a "tool proliferation problem" -- 26 tools means 80% more context per agent request. The V5.0 approach is the opposite: each MCP tool represents a complete business workflow, not a single browser action. An agent calls `nxt-lookup-customer` with an account number and gets structured data back. The browser complexity is fully encapsulated. This is the right abstraction for non-technical users and for Orq.ai's tool model (which limits tools per agent to 3-5 for quality).


## Sources

- [Microsoft Playwright MCP (GitHub)](https://github.com/microsoft/playwright-mcp) -- Official Playwright MCP server, Docker deployment options (HIGH confidence)
- [Playwright Test Generator (codegen)](https://playwright.dev/docs/codegen) -- Official Playwright codegen documentation (HIGH confidence)
- [Speakeasy -- Playwright Tool Proliferation Problem](https://www.speakeasy.com/blog/playwright-tool-proliferation) -- Analysis of 26-tool overhead, single-tool alternatives (MEDIUM confidence)
- [Bug0 -- Playwright MCP Changes Build vs Buy 2026](https://bug0.com/blog/playwright-mcp-changes-ai-testing-2026) -- Ecosystem overview of Playwright MCP servers (MEDIUM confidence)
- [Browserless -- From Codegen to Scalable Automation](https://www.browserless.io/blog/playwright-codegen-scalable-browserless-browserql) -- Best practices for hardening codegen output (MEDIUM confidence)
- [Promptwright (GitHub)](https://github.com/testronai/promptwright) -- Natural language to Playwright script generation tool (MEDIUM confidence)
- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) -- Official MCP tool definition spec (HIGH confidence)
- [Northflank -- Build and Deploy MCP Server](https://northflank.com/blog/how-to-build-and-deploy-a-model-context-protocol-mcp-server) -- MCP server deployment patterns (MEDIUM confidence)
- [Anthropic -- Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) -- On-demand tool loading, filesystem-based tool discovery (HIGH confidence)
- [Microsoft Playwright MCP Docker](https://hub.docker.com/r/microsoft/playwright-mcp) -- Docker image for Playwright MCP server (HIGH confidence)
- [BrowserStack -- Playwright Codegen Guide](https://www.browserstack.com/guide/how-to-use-playwright-codegen) -- Codegen patterns and locator strategies (MEDIUM confidence)
- [Orq.ai Agent Runtime](https://orq.ai/platform/agent-runtime) -- Platform tool integration model (MEDIUM confidence)

---
*Feature research for: V5.0 Browser Automation (Orq Agent Designer)*
*Researched: 2026-03-03*
