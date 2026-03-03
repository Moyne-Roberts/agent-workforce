# Pitfalls Research

**Domain:** Browser Automation Integration (V5.0 Extension of Orq Agent Designer)
**Researched:** 2026-03-03
**Confidence:** HIGH (well-documented domain; Playwright, MCP security, and LLM code generation all have extensive community experience)

**Scope:** Pitfalls specific to ADDING browser automation (Playwright script generation, VPS-hosted MCP server, agent spec wiring) to the existing agent design pipeline. V1.0-V4.0 pitfalls remain valid and are not repeated here.

---

## Critical Pitfalls

### Pitfall 1: LLM-Generated Playwright Scripts That Hallucinate Selectors

**What goes wrong:**
The pipeline's script generator LLM produces Playwright scripts without access to the actual DOM of target applications (NXT, iController, Intelly). Without real HTML context, the LLM guesses selectors based on training data -- producing scripts that look correct but target nonexistent elements. Scripts pass code review (they look syntactically valid and follow best practices) but fail on first real execution. Industry findings confirm that without application code or DOM context, "AI tools can only guess how your application works, and you're immediately inviting hallucinations."

**Why it happens:**
LLMs cannot reach out to analyze live HTML. They combine Playwright documentation patterns with guessed element names from training data. The generated code appears valid -- `page.getByRole('button', { name: 'Submit Invoice' })` looks right for an invoicing app -- but the actual NXT button might say "Post" or use a completely different element structure. Checkly's research found that "simply opening ChatGPT to tell it to create a test and expect a working result doesn't work at all."

**How to avoid:**
- Record real selectors first: use Playwright codegen (`npx playwright codegen [url]`) against each target system to capture actual DOM structure. Feed recordings as context to the LLM.
- Build an application context file per target system: HTML snapshots, accessibility tree dumps, or recorded selector inventories that the script generator receives as input.
- The application capabilities config file (already planned) must include a `domContext` or `selectorInventory` section per application with verified element identifiers.
- Never generate scripts "from description alone" -- always require recorded DOM evidence as input to the generator.

**Warning signs:**
- Scripts that work in code review but fail on first real execution
- Selectors using specific CSS classes or IDs that nobody manually verified exist in the target application
- Generated scripts that lack `data-testid` or `role`-based selectors (sign the LLM is guessing structure)
- No recorded DOM snapshots or accessibility tree dumps in the pipeline input

**Phase to address:**
Phase 1 (Application capabilities config) -- the config file must capture real DOM context per target system, not just "this app needs browser automation."

---

### Pitfall 2: Brittle Selectors That Break on Every Target System UI Update

**What goes wrong:**
Target systems (NXT, iController) ship UI updates that change class names, element hierarchy, or component structure. Scripts that worked yesterday fail silently or throw `TimeoutError`. Industry data shows 40-60% of QA effort goes to maintaining automation scripts against UI changes. For enterprise systems that Moyne Roberts does not control, updates arrive without warning.

**Why it happens:**
Scripts are coupled to implementation details (CSS classes, DOM structure, element positions) rather than stable, user-facing attributes. Third-party enterprise applications rarely expose `data-testid` attributes because they were not designed for external automation. Initial scripts work because they were validated against a specific UI version, but no mechanism exists to detect when the UI changes underneath them.

**How to avoid:**
- Prefer accessibility-tree-based selectors: `getByRole()`, `getByLabel()`, `getByText()` -- these survive most UI reshuffles because user-facing semantics rarely change even when markup does.
- For enterprise apps without good ARIA attributes, enforce a selector priority hierarchy in the script generator: `getByText()` > `getByRole()` > `data-testid` > CSS selector (last resort, explicitly flagged as fragile).
- Implement a Page Object Model (POM) pattern: isolate all selectors into per-application, per-page modules. When a selector breaks, fix one POM file, not every script that touches that page.
- Build a selector health check: a lightweight script that validates all registered selectors still resolve against the live application. Run on a schedule (daily or before script execution).

**Warning signs:**
- Scripts using deep CSS chains like `.main-content > div:nth-child(3) > table > tbody > tr:first-child`
- No POM layer -- selectors scattered directly in script logic
- Scripts that have been "fixed" more than twice for the same page
- No scheduled validation that selectors still resolve

**Phase to address:**
Phase 2 (Playwright script generation) -- the script generator template must enforce POM architecture and selector hierarchy from day one.

---

### Pitfall 3: VPS MCP Server Deployed Without Proper Authentication

**What goes wrong:**
The MCP server on the VPS is deployed with insufficient access control. Since it executes browser sessions that hold credentials to internal business systems (NXT, iController, Intelly), a compromised MCP server means an attacker can issue arbitrary browser commands against internal applications. Astrix Security research (2025) shows 88% of MCP servers require credentials but over half rely on insecure long-lived static secrets, with OAuth adoption at just 8.5%.

**Why it happens:**
MCP protocol is young. Default setups use stdio transport (local, no auth needed) and developers carry that assumption to remote deployments. The "just get it working" pressure leads to HTTP endpoints with API keys hardcoded in environment variables and no token rotation. OWASP's MCP security guide explicitly warns that "the default is insecure" for remote MCP server deployments.

**How to avoid:**
- Use mTLS (mutual TLS) between Orq.ai agents and the VPS MCP server -- both sides authenticate each other.
- If mTLS is too complex initially, use short-lived JWT tokens with audience and scope restrictions. Never use a single static API key as the sole auth mechanism.
- Run the MCP server behind a reverse proxy (nginx or caddy) with TLS termination, rate limiting, and IP allowlisting (restrict to Orq.ai's egress IPs if possible).
- Network isolation: VPS should accept connections only from known sources, with only the MCP port exposed through the reverse proxy.
- Implement structured request logging from day one: which agent called which tool, when, with what parameters (excluding secrets).

**Warning signs:**
- MCP server accessible on a public IP without TLS
- Authentication via a single static API key that never rotates
- No rate limiting on the MCP endpoint
- No audit log of tool invocations
- MCP server process running as root

**Phase to address:**
Phase 3 (VPS MCP server deployment) -- security architecture must be designed before the first deployment, not bolted on after.

---

### Pitfall 4: Credentials for Target Systems Stored Insecurely or Leaked

**What goes wrong:**
Browser automation requires logging into NXT, iController, etc. The credentials for these sessions end up hardcoded in scripts, committed to git, stored in plaintext environment variables on the VPS, or baked into container images. Playwright's `storageState` feature (saving auth cookies to JSON) creates files containing session tokens that get accidentally committed or left on disk. A single leak exposes access to internal business systems.

**Why it happens:**
During development, hardcoding credentials is the fastest path to a working demo. The "I'll secure it later" intent never materializes. Playwright storage state files are convenient but create persistent credential artifacts. Multiple sources confirm: "Credentials must never exist in test source code. Hardcoding a password inside a Playwright test is a day-zero security vulnerability."

**How to avoid:**
- Use a secrets manager from day one. For a single VPS, use systemd credential storage or encrypted environment files that are never in the repository. HashiCorp Vault or AWS Secrets Manager are options if the infrastructure justifies them.
- Playwright `storageState` JSON files must be in `.gitignore` and stored on tmpfs (memory-only filesystem) on the VPS, never persisted to disk.
- Create dedicated service accounts for automation with minimal permissions -- not reusing employee credentials. Each target system should have a dedicated "automation" user with narrowly scoped permissions.
- Never pass credentials as MCP tool parameters from the agent. The MCP server must resolve credentials internally based on which target system is being accessed. This prevents credentials from appearing in Orq.ai platform logs (which log tool call parameters).
- Implement credential rotation: service account passwords should rotate on a schedule. The MCP server fetches credentials at runtime, not at startup.

**Warning signs:**
- Credentials visible anywhere in `git log` history (even if removed from HEAD)
- Same credentials used for automation and human login
- `storageState` files persisted to non-ephemeral storage
- Credentials passed as parameters in MCP tool calls (visible in Orq.ai platform logs)
- No credential rotation schedule documented

**Phase to address:**
Phase 3 (VPS MCP server deployment) -- credential architecture must be part of the server design, not the script design.

---

### Pitfall 5: Treating Script Generation as a One-Shot Problem (No Maintenance Loop)

**What goes wrong:**
The pipeline generates Playwright scripts once during agent design, deploys them, and assumes they work indefinitely. No mechanism exists to detect when scripts start failing, no feedback loop to regenerate or repair them, and no versioning to roll back. When NXT ships a UI update, agents silently fail until someone manually notices degraded output quality.

**Why it happens:**
The existing V2.0 pipeline is designed for agent creation with optional iteration (test, iterate, harden). Browser scripts are treated like static configuration ("generate once, deploy forever") rather than living code that degrades over time. The pipeline has no concept of "script health" because agent specs themselves do not degrade the same way.

**How to avoid:**
- Build a health monitoring layer: each deployed script should have a "canary" check that runs periodically (daily at minimum) and verifies it can complete its flow against the live target system.
- Implement script versioning: every generated script gets a version tied to the application capabilities config version. When the config changes or a health check fails, scripts are flagged for regeneration.
- Design an alerting pipeline: when a script health check fails, notify the responsible team. Optionally trigger a regeneration workflow that captures the new DOM state and regenerates the script.
- Store script execution logs with screenshots at failure points -- these give the LLM context for regeneration when scripts need updating.

**Warning signs:**
- No scheduled health checks for deployed scripts
- No versioning scheme for scripts (scripts exist as single files with no history)
- No alert mechanism when scripts fail
- Scripts that have been "working" for weeks without any active verification
- No process defined for "what happens when NXT updates its UI"

**Phase to address:**
Phase 5 (Hardening) -- monitoring and maintenance loops should be the final phase. But the architecture for health checks and versioning must be designed in Phase 2 so scripts are generated with monitoring hooks from the start.

---

### Pitfall 6: Exposing Fine-Grained Browser Primitives as MCP Tools Instead of Workflow-Level Tools

**What goes wrong:**
The MCP server exposes Playwright API calls directly as individual MCP tools: `browser_click(selector)`, `browser_type(selector, text)`, `browser_navigate(url)`, `browser_wait(selector)`. Agents must then orchestrate multi-step browser workflows by calling 15-20 individual MCP tools in sequence. This creates fragile, slow, and token-expensive agent loops that frequently fail mid-sequence because the LLM agent makes incorrect decisions about timing, waiting, and error recovery at each step.

**Why it happens:**
Developers mirror Playwright's API surface directly onto MCP tools -- one method per tool. This feels "flexible" and "reusable." The Microsoft Playwright MCP server itself works this way (it exposes low-level browser actions for LLM-driven dynamic browsing). But that pattern is for dynamic browser-use, which is explicitly out of V5.0 scope. For deterministic, known flows, low-level primitives are the wrong abstraction.

**How to avoid:**
- Expose coarse-grained, workflow-level MCP tools: `nxt_create_invoice(data)`, `nxt_lookup_customer(id)`, `intelly_export_report(params)` -- not `browser_click(selector)`.
- Each MCP tool should encapsulate a complete Playwright script for one business workflow. The agent says "create this invoice" and the MCP tool handles the entire browser sequence internally, including error recovery and retries.
- This aligns with V5.0's stated design intent: "Fixed/deterministic Playwright scripts only. Dynamic browser-use already handled by existing Orq.ai MCP tools." Enforce this strictly -- no generic browser primitives exposed as tools.
- The MCP server becomes a "business action API" backed by Playwright, not a "remote browser control API."

**Warning signs:**
- MCP tools named `click`, `type`, `navigate`, `waitForSelector`, `screenshot`
- Agent instructions that include browser automation guidance (e.g., "first navigate to NXT, then click...")
- Agent iterations where 80%+ of tool calls are browser primitives
- High token usage on tasks that should be simple data lookups or form submissions
- Agent failures mid-sequence because it chose the wrong selector or timing

**Phase to address:**
Phase 2 (Script generation) and Phase 3 (MCP server) -- the tool interface design must be settled before scripts are generated. This is an architectural decision, not an implementation detail.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded selectors without POM | Faster initial script generation | Every UI change requires editing multiple scripts; maintenance burden multiplies with each new workflow | Never -- POM adds minimal upfront effort, saves days of maintenance |
| Single monolithic script per application | Simpler to generate and deploy | Cannot reuse flows across agents; cannot update one workflow without risking others; testing is all-or-nothing | Only for initial proof-of-concept with one target system (NXT) |
| Static API key auth on MCP server | Quick to deploy and test | Security liability; no rotation; no audit trail; single key compromise = full access | Only during local development; never on VPS |
| Skipping health checks | Faster initial delivery | Silent failures when target UIs change; users discover problems days later via degraded agent output | Never -- even a basic "can the script still log in" check is essential |
| Employee credentials for automation | No need to create service accounts | Credential sharing violates policy; employee password change breaks all automation; audit trail shows employee "doing" things the bot did | Never -- create service accounts from day one |
| Generating scripts without DOM context | Can start building before anyone records selectors | Every generated script is a hallucination that will fail; time spent is wasted | Never -- recording selectors is a prerequisite, not an optimization |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Orq.ai agent specs referencing MCP tools | Hardcoding VPS URL in agent tool definitions | Agent specs reference tool names; MCP server URL is external configuration. Use environment-based server URLs so dev/staging/production can differ |
| Capabilities config feeding script generator | Config only says "needs browser automation" without DOM context | Config must include selector inventories, page flow maps, accessibility tree snapshots, or at minimum a reference to recorded codegen output |
| Script deployment to VPS | Manual SCP/SSH deployment by a developer | Automated deployment via the pipeline (MCP tool or CI/CD). Non-technical users should never need to touch a terminal |
| Playwright auth to target systems | Re-authenticating on every single script execution | Use persistent `storageState` with scheduled refresh; detect auth expiry and re-login only when needed. Cold login on every run wastes 5-15 seconds and increases failure risk |
| Existing discussion step | Discussion step does not ask about browser integration requirements | Add browser-capability questions for unknown systems: "Does this system have an API? Is browser access required? What pages/flows would the agent need?" |
| Pipeline ordering: deploy then wire | Generating agent specs that reference MCP tools before those tools exist on the VPS | Script deployment to VPS must happen before agent spec wiring. Pipeline must enforce this ordering -- you cannot wire an agent to a tool that does not exist yet |
| Existing spec generator output | Spec generator does not know about MCP tool names available on VPS | After script deployment, feed the list of available MCP tool names back to the spec generator so it can wire agent specs correctly |
| Playwright + enterprise SSO | Target system uses SSO/MFA that blocks automated login | Service accounts must bypass SSO/MFA or use a pre-authenticated session approach. Verify auth method per target system during capabilities config phase |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cold browser launch per MCP request | 5-15 second response time for every tool call | Keep browser context alive between requests; reuse browser instances with connection pooling | At >5 concurrent agent requests per minute |
| `waitForLoadState('networkidle')` everywhere | Scripts take 10-30 seconds for simple data extractions | Wait for specific elements (`waitForSelector`) not full page idle; enterprise apps often have background polling that never reaches "idle" | Immediately on slow enterprise apps |
| Screenshot capture on every step | Disk fills up; script execution slows; storage costs increase | Screenshots only on failure or explicit debug mode; store in rotating buffer, not permanently | At >100 script executions per day |
| No browser context reuse | Each execution opens new browser, new login, new context | Maintain a pool of authenticated browser contexts per target system; refresh auth periodically | At >3 concurrent sessions to the same target system |
| Synchronous script execution blocking MCP server | MCP server unresponsive while a long script runs | Run scripts asynchronously; return immediately with a task ID; provide a status check tool | When any script takes >30 seconds |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| MCP server endpoint without TLS | Credentials and business data transmitted in plaintext over the network | Mandatory TLS via reverse proxy; reject all non-TLS connections |
| Employee credentials used for automation | Credential sharing violates policy; employee password change breaks automation; audit shows employee "actions" that were bot actions | Dedicated service accounts per target system with separate lifecycle and rotation |
| No rate limiting on MCP server | Runaway agent loop executes hundreds of browser actions per minute against internal systems; could trigger lockouts or data corruption | Rate limit per tool, per agent, per minute; circuit breaker on repeated failures |
| Playwright running as root on VPS | Browser exploit (e.g., via malicious page content in target system) could compromise entire server | Run Playwright in unprivileged container or user namespace; never run browser process as root |
| MCP tool parameters containing credentials | Orq.ai platform logs tool call parameters; credentials become visible in platform logs and potentially in agent conversation history | Credentials resolved server-side only; MCP tools accept business identifiers (invoice ID, customer name), never credentials |
| No audit logging of browser actions | Cannot trace which agent performed which action on which internal system; no forensics after an incident | Structured logging on every MCP call: agent ID, tool name, target system, timestamp, success/failure, duration |
| StorageState files on persistent disk | Leaked session tokens enable unauthorized access to internal systems without needing credentials | Store on tmpfs; set file permissions to owner-only; auto-delete after configurable TTL |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Non-technical users asked to debug failed browser scripts | Users cannot interpret Playwright errors (`TimeoutError`, selector failures); lose trust in the system | Surface business-level errors ("Could not find customer X in NXT" or "NXT login failed -- contact IT") not technical stack traces |
| No visibility into script health status | Users discover scripts are broken only when agents return empty or wrong data, potentially days after the break occurred | Dashboard or status indicator showing script health per target system per workflow; green/yellow/red |
| Application capabilities config requires technical knowledge | Non-technical users cannot add new systems or update config when new workflows are needed | Guided discussion step that asks plain-language questions about the target system and generates config entries automatically |
| Silent script failures with no user notification | Agents appear to work but return stale, incomplete, or no data from target systems | Mandatory success/failure status on every MCP tool response; agent specs must include explicit error handling for tool failures |
| Users expected to manage VPS or deployment | Any manual VPS interaction violates the "without touching a terminal" requirement | Pipeline handles deployment end-to-end; users only interact via web UI or Claude Code skill |

## "Looks Done But Isn't" Checklist

- [ ] **Script generation:** Often missing real DOM context -- verify generated selectors against live application before first deployment
- [ ] **MCP server auth:** Often missing proper authentication -- verify by attempting unauthenticated request from an external IP; should be rejected
- [ ] **TLS:** Often missing on MCP endpoint -- verify with `curl` that HTTPS is required and HTTP is rejected
- [ ] **Credential storage:** Often insecure -- verify no credentials in git history, no plaintext on VPS disk, rotation schedule documented
- [ ] **Agent spec wiring:** Often missing error handling -- verify agent spec has explicit fallback behavior when MCP tool returns an error
- [ ] **Health monitoring:** Often completely absent -- verify scheduled canary checks exist and run for every deployed script
- [ ] **Selector stability:** Often using fragile CSS selectors -- audit all selectors; flag any CSS/XPath usage as technical debt
- [ ] **Deployment automation:** Often still requires SSH -- verify scripts can be deployed through the pipeline without terminal access
- [ ] **Audit logging:** Often missing or unstructured -- verify every MCP tool call logged with agent ID, tool name, target system, outcome
- [ ] **Rate limiting:** Often absent -- verify MCP server rejects requests above configured rate; circuit breaker activates on repeated failures
- [ ] **Service accounts:** Often using shared/employee credentials -- verify each target system has a dedicated automation account with minimal permissions
- [ ] **Pipeline ordering:** Often spec wiring attempted before script deployment -- verify pipeline enforces deploy-before-wire ordering

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hallucinated selectors in generated scripts | LOW | Record real selectors via Playwright codegen against live app; regenerate scripts with DOM context; redeploy to VPS |
| Brittle selectors breaking after UI update | MEDIUM | Update POM files with new selectors from fresh codegen recording; regenerate affected scripts; run health check to verify all workflows pass |
| MCP server security breach | HIGH | Rotate ALL credentials for ALL target systems immediately; audit MCP server logs for unauthorized actions; redeploy server with proper auth; review target system accounts for unauthorized changes; notify security team |
| Credentials leaked in git history | HIGH | Rotate all affected credentials immediately; use BFG Repo-Cleaner to purge history; enforce pre-commit hooks for secret detection (e.g., gitleaks); verify no unauthorized access occurred using leaked credentials |
| Fine-grained MCP tools (wrong abstraction) | MEDIUM | Refactor tools to workflow-level granularity; update all agent specs to reference new tool names; redeploy; painful but not data-destructive |
| Silent script failures undetected | MEDIUM | Audit recent agent outputs for data quality/completeness; manually verify against target systems; deploy health monitoring; backfill any missed business operations |
| No maintenance loop (scripts degraded silently) | MEDIUM | Assess current script health across all target systems; record fresh DOM snapshots; regenerate broken scripts; deploy health monitoring and alerting to prevent recurrence |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Hallucinated selectors | Phase 1 (Capabilities config with DOM context) | Config entries include real selector inventories or codegen recordings; no script generated without verified DOM input |
| Brittle selectors | Phase 2 (Script generation with POM enforcement) | All generated scripts use POM pattern; selector health check passes for every script before deployment |
| MCP server security | Phase 3 (VPS deployment with security-first design) | Unauthenticated requests rejected; TLS enforced; rate limits active; audit logging verified |
| Credential mismanagement | Phase 3 (VPS deployment with secrets architecture) | No credentials in git; no plaintext on disk; dedicated service accounts with rotation schedule documented |
| No maintenance loop | Phase 5 (Hardening and monitoring) | Scheduled health checks running for every deployed script; alerts fire within 1 hour of script failure |
| Wrong MCP tool granularity | Phase 2-3 (Tool interface design) | All MCP tools are workflow-level (business actions); no generic browser primitives exposed |
| Poor error surfacing | Phase 4 (End-to-end integration) | Agent specs include error handling for MCP tool failures; error messages are business-level, not technical |
| Pipeline ordering violation | Phase 4 (Integration) | Pipeline enforces script deployment before agent spec wiring; cannot wire to nonexistent tool |
| Enterprise SSO blocking automation | Phase 1 (Capabilities config) | Auth method verified per target system; service accounts confirmed to bypass SSO/MFA or have pre-auth approach |

## Sources

- [Playwright Official Best Practices](https://playwright.dev/docs/best-practices) -- Selector strategy, flaky test avoidance
- [BrowserStack: Playwright Selector Best Practices 2026](https://www.browserstack.com/guide/playwright-selectors-best-practices) -- Selector reliability patterns
- [Better Stack: Avoiding Flaky Playwright Tests](https://betterstack.com/community/guides/testing/avoid-flaky-playwright-tests/) -- Timing, waiting, and selector stability
- [OWASP: Practical Guide for Secure MCP Server Development](https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/) -- MCP-specific security controls
- [OWASP: Guide for Securely Using Third-Party MCP Servers](https://genai.owasp.org/resource/cheatsheet-a-practical-guide-for-securely-using-third-party-mcp-servers-1-0/) -- Client-side MCP security
- [Akto: Top MCP Security Best Practices 2026](https://www.akto.io/blog/mcp-security-best-practices) -- Authentication, input validation, monitoring
- [TrueFoundry: MCP Server Security Best Practices](https://www.truefoundry.com/blog/mcp-server-security-best-practices) -- Runtime isolation, sandboxing
- [WorkOS: Complete Guide to MCP Security](https://workos.com/blog/mcp-security-risks-best-practices) -- OAuth, mTLS, token binding
- [Astrix: State of MCP Server Security 2025](https://astrix.security/learn/blog/state-of-mcp-server-security-2025/) -- 88% credential reliance, 8.5% OAuth adoption statistics
- [Medium: Secure Credential Management in Playwright (2026)](https://medium.com/@sajith-dilshan/secure-credential-management-in-playwright-0cf75c4e2ff4) -- Credential isolation patterns
- [Checkly: Generating E2E Tests with AI and Playwright MCP](https://www.checklyhq.com/blog/generate-end-to-end-tests-with-ai-and-playwright/) -- LLM hallucination in script generation
- [Checkly: Playwright Codegen with GitHub Copilot](https://www.checklyhq.com/blog/playwright-codegen-with-github-copilot/) -- AI code generation limitations
- [Microsoft Playwright MCP Server (GitHub)](https://github.com/microsoft/playwright-mcp) -- Official MCP server architecture
- [Awesome Testing: Playwright MCP Security](https://www.awesome-testing.com/2025/11/playwright-mcp-security) -- Playwright-specific MCP security patterns

---
*Pitfalls research for: V5.0 Browser Automation (Playwright + MCP + Orq.ai agent pipeline)*
*Researched: 2026-03-03*
