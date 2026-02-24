# orq-agent

Generate complete, copy-paste-ready Orq.ai Agent specifications with orchestration logic from use case descriptions.

## Directory Structure

```
orq-agent/
  SKILL.md                       # This file -- skill index
  agents/
    architect.md                 # Architect subagent: analyzes use cases, produces blueprints
  templates/
    agent-spec.md                # Template: individual agent specification
    orchestration.md             # Template: swarm orchestration document
    dataset.md                   # Template: test dataset with adversarial cases
    readme.md                    # Template: swarm README for non-technical users
  references/
    orqai-agent-fields.md        # Orq.ai v2 API field reference (18 fields, 15 tool types)
    orqai-model-catalog.md       # Model catalog by use case (14 providers, 12 models)
    orchestration-patterns.md    # Three orchestration patterns with complexity gate
    naming-conventions.md        # Agent key naming rules with regex validation
```

## Output Directory Convention

Generated swarms are written to the following structure:

```
Agents/[swarm-name]/
  ORCHESTRATION.md               # Swarm orchestration document (multi-agent only)
  agents/
    [agent-name].md              # Per-agent specification
  datasets/
    [agent-name]-dataset.md      # Per-agent test data with adversarial cases
  README.md                      # Setup guide for non-technical users
```

- `[swarm-name]` matches the domain portion of agent keys (e.g., `customer-support`)
- Single-agent swarms still use this structure (ORCHESTRATION.md is omitted)
- All files are markdown -- no runtime code, no dependencies

## Subagents

### Phase 1 (Foundation)

| Agent | File | Purpose |
|-------|------|---------|
| Architect | `agents/architect.md` | Analyzes use cases, applies complexity gate, produces swarm blueprints |

### Phase 2 (Core Generation) -- Planned

| Agent | Purpose |
|-------|---------|
| Researcher | Gathers domain context for the use case |
| Spec Generator | Fills agent-spec template from architect blueprint |
| Orchestration Generator | Creates ORCHESTRATION.md for multi-agent swarms |
| Tool Schema Generator | Produces JSON Schema for function/HTTP tools |
| Dataset Generator | Creates test datasets with adversarial cases |

## References

| File | Purpose |
|------|---------|
| `orqai-agent-fields.md` | All 18 Orq.ai v2 API fields and 15 tool types with configuration JSON |
| `orqai-model-catalog.md` | 14 providers with format patterns, 12 curated models across 5 use cases |
| `orchestration-patterns.md` | Single, sequential, and parallel patterns with selection criteria and complexity gate |
| `naming-conventions.md` | `[domain]-[role]-agent` convention, regex validation, 12 valid and 7 invalid examples |

## Templates

| File | Purpose |
|------|---------|
| `agent-spec.md` | Template for individual agent specs with all Orq.ai fields and tool subsections |
| `orchestration.md` | Template for swarm orchestration docs with setup steps and data flow |
| `dataset.md` | Template for test datasets requiring 30% adversarial cases minimum |
| `readme.md` | Template for swarm READMEs with non-technical setup instructions |

## Key Design Decisions

- **Complexity gate:** Architect defaults to single-agent design; each additional agent requires explicit justification
- **Reference files under 1000 words:** Preserves subagent context window for reasoning
- **{{PLACEHOLDER}} format:** Matches Orq.ai native variable syntax for consistency
- **Self-contained templates:** Each template has its own legend; no cross-template dependencies
- **Hyphens-only naming:** Agent keys use kebab-case despite regex allowing dots and underscores
