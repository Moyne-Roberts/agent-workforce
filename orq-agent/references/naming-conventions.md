# Orq.ai Agent Naming Conventions

Rules for naming agent keys, swarm directories, and version tags. All downstream subagents reference this to produce valid, consistent identifiers.

## The Rule

Agent keys follow the **`[domain]-[role]-agent`** kebab-case convention.

- **domain**: The business area or function (e.g., `invoice`, `customer-support`, `hr`)
- **role**: What the agent does (e.g., `validator`, `triage`, `extraction`)
- **agent**: Always the suffix -- identifies the key as an agent

## Validation Regex

```
^[A-Za-z][A-Za-z0-9]*([._-][A-Za-z0-9]+)*$
```

**In plain English:** Must start with a letter. After that, allows letters, digits, and separators (`.`, `_`, `-`). Each separator must be followed by at least one letter or digit. No consecutive separators. No trailing separators.

**Recommended separator:** Use hyphens (`-`) exclusively for agent keys. While dots and underscores are technically valid per the regex, kebab-case with hyphens is the project convention.

## Valid Examples

| Key | Explanation |
|-----|-------------|
| `invoice-validator-agent` | Standard `[domain]-[role]-agent` pattern |
| `hr-onboarding-agent` | Two-part domain, single role |
| `customer-support-triage-agent` | Multi-word domain with role |
| `data-extraction-agent` | Generic domain, specific role |
| `email-classifier-agent` | Simple domain and role |
| `order-fulfillment-agent` | Business process domain |
| `content-moderation-agent` | Safety/compliance domain |
| `lead-scoring-agent` | Sales domain |
| `document-summarizer-agent` | Document processing domain |
| `payment-reconciliation-agent` | Finance domain |
| `inventory-monitor-agent` | Operations domain |
| `customer-support-orchestrator-agent` | Orchestrator role in multi-agent swarm |

## Invalid Examples

| Key | Problem |
|-----|---------|
| `InvoiceValidator` | No camelCase. Use kebab-case with hyphens. |
| `invoice_validator_agent` | No underscores in agent keys. Use hyphens: `invoice-validator-agent`. |
| `agent-invoice-validator` | `agent` must be the suffix, not the prefix. |
| `invoice validator agent` | No spaces allowed. Use hyphens between words. |
| `123-invoice-agent` | Must start with a letter, not a digit. |
| `invoice--validator-agent` | No consecutive separators. Use single hyphens. |
| `INVOICE-VALIDATOR-AGENT` | Avoid ALL_CAPS. Use lowercase kebab-case. |

## Swarm Directory Naming

The swarm directory name matches the **domain portion** of the agent keys within it.

```
Agents/
  customer-support/          # Domain: customer-support
    ORCHESTRATION.md
    agents/
      customer-support-triage-agent.md
      customer-support-escalation-agent.md
      customer-support-orchestrator-agent.md
    README.md
```

All agents in a swarm share the same domain prefix. The directory name is that shared prefix.

**Single-agent swarms:** The directory still uses the domain portion: `invoice/agents/invoice-validator-agent.md`.

## Version Tagging

Agent keys support a `@version-number` suffix for versioning:

```
invoice-validator-agent@2       # Version 2
customer-support-triage-agent@3 # Version 3
```

- The base key (without `@version`) refers to the latest version.
- Use version tags when you need to run multiple versions simultaneously or roll back.
- Version numbers are positive integers. No semantic versioning (no `@1.2.3`).

## Quick Reference

- **Format:** `[domain]-[role]-agent`
- **Case:** lowercase kebab-case
- **Separator:** hyphens only (convention)
- **Suffix:** always ends with `-agent`
- **Regex:** `^[A-Za-z][A-Za-z0-9]*([._-][A-Za-z0-9]+)*$`
- **Directory:** matches domain portion of agent keys
- **Versioning:** `@N` suffix (optional)
