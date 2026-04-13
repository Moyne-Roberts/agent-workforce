## ARCHITECTURE COMPLETE

**Swarm name:** cura-email-swarm
**Agent count:** 4
**Pattern:** parallel-with-orchestrator
**Complexity justification:** Four agents justified: (1) Orchestrator uses a fast, cheap model (`openai/gpt-4.1-mini`) for category-to-specialist mapping — different model from response agents (justification a). It has no KB tools, only agent delegation tools — fundamentally different tool set (justification c). (2-4) Three specialist response agents handle fundamentally different category groups with distinct domain knowledge, escalation thresholds, and communication patterns. The current single response agent is proven insufficient — prompt complexity exceeds manageable limits when covering all category groups with category-specific examples, escalation rules, and self-service patterns. Each specialist's prompt is focused and testable independently.

### Context: Integration with Existing Zapier Flow

**The existing Zapier flow (22 steps) remains UNCHANGED.** Only the Orq.ai agent at step 20 (Response Agent) is replaced by this swarm.

**What stays as-is:**
- Step 1: Outlook trigger (new email)
- Step 2: Zapier Tables record creation
- Step 3: Intake (GPT-4o-mini, mail opschonen + metadata)
- Step 4-5: Notion category lookup + formatting
- Step 6: Classification (GPT-4o-mini, klasse + categorie + sentiment)
- Step 7: Update Zapier Tables
- Steps 8-9: Branch A — GEEN-ACTIE-NODIG → move to folder (step 22)
- Step 10: Branch B — NOT GEEN-ACTIE-NODIG → continue
- Step 11: **Routing Agent** (`curabhv-email-routing-agent`) — stays, determines AI_CAN_ANSWER vs HUMAN_REQUIRED
- Steps 12-15: Update record, counter, code step
- Steps 16-18: Branch C/D — AI_CAN_ANSWER vs HUMAN_REQUIRED
- Step 19: HUMAN_REQUIRED → move to folder
- Step 21: Create draft reply in Outlook
- Step 22: Move GEEN-ACTIE-NODIG to folder

**What changes:**
- **Step 20 ONLY:** `curabhv-email-response-agent` → replaced by `cura-email-orchestrator-agent`
- The orchestrator receives the same input the current Response Agent gets (routing metadata + email context)
- The orchestrator returns the same output format (HTML draft reply or [ESCALATIE])
- Zapier flow logic around step 20 stays identical

### Agents

#### 1. cura-email-orchestrator-agent
- **Role:** Category-Based Response Dispatcher
- **Responsibility:** Receives email context and routing metadata from the upstream Routing Agent (via Zapier step 20). At this point, the email is already confirmed as AI_CAN_ANSWER. The orchestrator's only job is to map the category to the correct specialist agent and return their response. Maps categories to 3 specialist groups: Training & Cursus, Digitaal & Portaal, Zakelijk & Administratie. For categories not mapped to any specialist (edge case — should not happen given upstream filtering), returns [ESCALATIE]. Passes through the specialist's HTML response or [ESCALATIE] signal unchanged.
- **Model recommendation:** `openai/gpt-4.1-mini`
- **Tools needed:** `retrieve_agents`, `call_sub_agent`
- **Knowledge base:** none
- **KB description:** N/A
- **Receives from:** user input (Zapier step 20 via invoke_agent — same input as current Response Agent)
- **Passes to:** cura-email-training-agent, cura-email-digitaal-agent, or cura-email-zakelijk-agent (based on category)

#### 2. cura-email-training-agent
- **Role:** Training & Cursus Email Specialist
- **Responsibility:** Composes HTML draft replies for emails in the training & cursus category group: INSCHRIJVEN-ANNULEREN-WIJZIGEN, CERTIFICAAT-HERCERTIFICERING, CURSUSAANBOD-LEERPADEN, PRAKTIJKSESSIES-OEFENEN-LOCATIE. Queries the CURA BHV knowledge base for relevant articles. Handles self-service patterns (inschrijvingen via website, certificaat opvragen, herhalingscursus info). Adjusts tone based on sentiment score. Returns HTML mail body starting with greeting, ending with "CURA BHV", or returns [ESCALATIE] signal when KB has no answer. Responds in the same language as the incoming email.
- **Model recommendation:** `anthropic/claude-sonnet-4-20250514`
- **Tools needed:** `query_knowledge_base`, `retrieve_knowledge_bases`
- **Knowledge base:** mixed
- **KB description:** CURA BHV Notion knowledge base (ID: 01KKE67KZ3VTZD40H48847X0VM) containing training schedules, certification policies, enrollment procedures, course content descriptions, practical session locations, and FAQs
- **Receives from:** cura-email-orchestrator-agent
- **Passes to:** cura-email-orchestrator-agent (returns HTML draft or escalation)

#### 3. cura-email-digitaal-agent
- **Role:** Digitaal & Portaal Email Specialist
- **Responsibility:** Composes HTML draft replies for emails in the digital & portal category group: PORTAAL-INLOG-HARDNEKKIG, ONLINE-LEEROMGEVING-OPDRACHTEN, PORTAAL-APP-GEBRUIK. Strong self-service focus: explains step-by-step how to resolve login issues, upload assignments, use the digi-instructeur, and navigate the klantenportaal. Queries the CURA BHV knowledge base. Always ends self-service answers with "Lukt het niet? Neem dan gerust contact met ons op, dan helpen we je verder." Returns HTML or [ESCALATIE]. Responds in the same language as the incoming email.
- **Model recommendation:** `anthropic/claude-sonnet-4-20250514`
- **Tools needed:** `query_knowledge_base`, `retrieve_knowledge_bases`
- **Knowledge base:** mixed
- **KB description:** CURA BHV Notion knowledge base (ID: 01KKE67KZ3VTZD40H48847X0VM) containing portal login guides, digi-instructeur documentation, ThuisCompetentBox instructions, assignment upload procedures, and troubleshooting steps
- **Receives from:** cura-email-orchestrator-agent
- **Passes to:** cura-email-orchestrator-agent (returns HTML draft or escalation)

#### 4. cura-email-zakelijk-agent
- **Role:** Zakelijk & Administratie Email Specialist
- **Responsibility:** Composes HTML draft replies for emails in the business & admin category group: ADMINISTRATIE-PRIVACY-GEGEVENSVERWERKING, HR-SYSTEMEN-SYSTEEMINTEGRATIES, LEVERANCIER-OFFERTE, SECTOR-MAATWERK-VRAGEN. Low AI-answer rate expected — this agent escalates quickly for facturen, betaalspecificaties, incompany offertes, and maatwerk requests. Only answers when the KB contains a clear, complete answer (e.g., AVG/privacy policy, general administrative procedures). Returns HTML or [ESCALATIE]. Responds in the same language as the incoming email.
- **Model recommendation:** `anthropic/claude-sonnet-4-20250514`
- **Tools needed:** `query_knowledge_base`, `retrieve_knowledge_bases`
- **Knowledge base:** mixed
- **KB description:** CURA BHV Notion knowledge base (ID: 01KKE67KZ3VTZD40H48847X0VM) containing administrative procedures, privacy/AVG policies, and general business information
- **Receives from:** cura-email-orchestrator-agent
- **Passes to:** cura-email-orchestrator-agent (returns HTML draft or escalation)

### Orchestration

- **Orchestrator:** cura-email-orchestrator-agent
- **Agent-as-tool assignments:** cura-email-training-agent, cura-email-digitaal-agent, and cura-email-zakelijk-agent are tools of cura-email-orchestrator-agent
- **Data flow:**
  1. Zapier step 20 invokes orchestrator with the same input as the current Response Agent: routing metadata (routing, kb_urls, kb_onderwerp, vraag_type, detected_language, confidence, motivatie) + original email context (subject, body, sender_name, sender_email, sentiment, sentiment_score, categorie)
  2. Orchestrator maps categorie to specialist group (see routing map below)
  3. Orchestrator calls the appropriate sub-agent via `call_sub_agent`, passing all context
  4. Sub-agent queries KB (max 2 queries), composes HTML reply or returns [ESCALATIE]
  5. Orchestrator returns the sub-agent's response directly — same output format as the current Response Agent (HTML starting with greeting or [ESCALATIE] signal)
  6. Zapier step 21 creates draft reply in Outlook (unchanged)
- **Error handling:**
  - If a sub-agent fails or times out: orchestrator returns `[ESCALATIE] Specialist agent fout — mail moet handmatig worden beantwoord.`
  - If sub-agent returns [ESCALATIE]: orchestrator passes through the [ESCALATIE] message unchanged
  - If category is unknown or not mapped to a specialist: orchestrator returns `[ESCALATIE] Categorie niet herkend — handmatige beoordeling vereist.`

### Category-to-Agent Routing Map

The orchestrator uses this mapping. All categories listed here are the ones that reach step 20 (already filtered by upstream Zapier steps and Routing Agent).

| Category | Specialist Agent |
|----------|-----------------|
| INSCHRIJVEN-ANNULEREN-WIJZIGEN | cura-email-training-agent |
| CERTIFICAAT-HERCERTIFICERING | cura-email-training-agent |
| CURSUSAANBOD-LEERPADEN | cura-email-training-agent |
| PRAKTIJKSESSIES-OEFENEN-LOCATIE | cura-email-training-agent |
| PORTAAL-INLOG-HARDNEKKIG | cura-email-digitaal-agent |
| ONLINE-LEEROMGEVING-OPDRACHTEN | cura-email-digitaal-agent |
| PORTAAL-APP-GEBRUIK | cura-email-digitaal-agent |
| ADMINISTRATIE-PRIVACY-GEGEVENSVERWERKING | cura-email-zakelijk-agent |
| HR-SYSTEMEN-SYSTEEMINTEGRATIES | cura-email-zakelijk-agent |
| LEVERANCIER-OFFERTE | cura-email-zakelijk-agent |
| SECTOR-MAATWERK-VRAGEN | cura-email-zakelijk-agent |

**Note:** Categories like GEEN-ACTIE-NODIG, INTERNE-COMMUNICATIE, SYSTEEM-*, KLACHTEN-FEEDBACK-CONTACT never reach the orchestrator — they are filtered upstream by Zapier (step 8-9) and the Routing Agent (step 11).

### Shared Communication Rules (All Specialists)

These rules come from the proven current Response Agent and apply to all three specialists:

1. **Toonzetting op sentiment:**
   - Positief (61-100): Warm en vrolijk, niet overdreven
   - Neutraal (31-60): To-the-point, snel naar het antwoord
   - Negatief (0-30): Oprecht meelevend, kort erkennen, snel naar oplossing

2. **Output format:** Alleen HTML mailtekst. Begint met aanhef, eindigt met "CURA BHV". Geen JSON, geen headers, geen labels.

3. **Self-service patroon:** Wanneer vraag_type "actie" is maar KB beschrijft hoe de cursist het zelf kan: stappen uitleggen + KB-link + "Lukt het niet? Neem dan gerust contact met ons op."

4. **Escalatie:** Wanneer KB geen passend antwoord heeft: `[ESCALATIE] Geen passend kennisbankartikel gevonden voor: [omschrijving]. Reden: [waarom KB niet toereikend]. Deze mail moet door een medewerker worden beantwoord.`

5. **Communicatiestijl:** Professioneel maar persoonlijk, tutoyeren, korte zinnen, CURA in hoofdletters, geen interne identifiers, geen beloftes over termijnen/terugbetalingen, nooit zeggen dat je AI bent, antwoord in de taal van de inkomende mail.

6. **KB zoekstrategie:** Gebruik kb_onderwerp en kb_urls van Routing Agent als primaire input. Max 2 KB queries. Geen eigen antwoorden verzinnen.

### Model Fallback Configuration

| Agent | Primary | Fallback 1 | Fallback 2 | Fallback 3 |
|-------|---------|------------|------------|------------|
| cura-email-orchestrator-agent | `openai/gpt-4.1-mini` | `azure/gpt-4.1-mini` | `google-ai/gemini-2.5-flash` | `groq/llama-3.3-70b-versatile` |
| cura-email-training-agent | `anthropic/claude-sonnet-4-20250514` | `openai/gpt-4.1` | `google-ai/gemini-2.5-pro` | `anthropic/claude-sonnet-4-5-20250929` |
| cura-email-digitaal-agent | `anthropic/claude-sonnet-4-20250514` | `openai/gpt-4.1` | `google-ai/gemini-2.5-pro` | `anthropic/claude-sonnet-4-5-20250929` |
| cura-email-zakelijk-agent | `anthropic/claude-sonnet-4-20250514` | `openai/gpt-4.1` | `google-ai/gemini-2.5-pro` | `anthropic/claude-sonnet-4-5-20250929` |

### Migration Plan

**Minimale impact — alleen stap 20 wijzigt:**

1. Maak de 4 nieuwe agents aan in Orq.ai (in de EASY email map)
2. Configureer `team_of_agents` op de orchestrator
3. Test de orchestrator met dezelfde test-mails die de huidige Response Agent krijgt
4. Wijzig Zapier stap 20: verander `agent_key` van `curabhv-email-response-agent` naar `cura-email-orchestrator-agent`
5. Monitor eerste week — vergelijk escalatie-rate en draft-kwaliteit
6. Huidige `curabhv-email-response-agent` kan blijven bestaan als fallback
