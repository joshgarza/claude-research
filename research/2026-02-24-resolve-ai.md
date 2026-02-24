---
date: 2026-02-24
topic: Resolve.ai
status: complete
tags: [ai-agents, sre, observability, incident-management, production-engineering, agentic-ai]
---

# Resolve.ai

## Context

Investigated Resolve.ai — a startup building autonomous AI SRE (Site Reliability Engineering) agents for production engineering teams. The company hit unicorn status ($1B valuation) in late 2025 after a $125M Series A led by Lightspeed, having previously raised a $35M seed from Greylock. Founded by the co-creators of OpenTelemetry and former Splunk observability leaders, the company represents a significant bet on AI agents fully replacing human on-call toil.

---

## Findings

### Company Overview

**Resolve.ai** (resolve.ai) is an AI production engineering platform that autonomously investigates and resolves production incidents. It should not be confused with **Resolve** (resolve.io), a separate ITSM automation company targeting IT helpdesk teams.

- **Founded:** Early 2024
- **HQ:** San Francisco, CA
- **Founders:** Spiros Xanthos (CEO) and Mayank Agarwal (CTO)
- **Funding:** $35M seed (Greylock) + $125M Series A (Lightspeed) = $160M+ total
- **Valuation:** ~$1B (unicorn, December 2025)
- **Revenue:** ~$11.3M ARR as of November 2025 (started at $4M ARR at Series A announcement)
- **Team size:** ~103 people

Sources: [SiliconANGLE](https://siliconangle.com/2026/02/04/resolve-ai-raises-125m-1b-valuation-automate-application-maintenance/), [TechCrunch](https://techcrunch.com/2025/12/19/ex-splunk-execs-startup-resolve-ai-hits-1-billion-valuation-with-series-a/), [Latka](https://getlatka.com/companies/resolve.ai)

---

### Founding Story & Pedigree

The founders have an unusually strong origin story for this market:

- **Spiros Xanthos** and **Mayank Agarwal** met at University of Illinois Urbana-Champaign (UIUC) ~20 years ago.
- Both were early contributors to the **OpenTelemetry** open-source project — the industry standard for distributed telemetry (traces, metrics, logs). This gives them deep credibility in observability infrastructure.
- Together they founded **Omnition**, a next-generation distributed tracing startup, which Splunk acquired in 2019.
- Post-acquisition, they ran Splunk's observability business as GM and Chief Architect respectively.
- Left Splunk to self-fund Resolve AI in early 2024, recruiting two early Omnition engineers as co-founders.

The founding insight came from watching talented engineers burn out at Splunk due to the unrelenting burden of on-call incident management. Despite vast investment in observability tooling, the _cognitive work_ of diagnosing and fixing production issues remained entirely manual.

**Key angel investors:** Jeff Dean (Google), Reid Hoffman (LinkedIn), Fei-Fei Li (Stanford AI), plus executives from AWS, GitHub, OpenAI, Snowflake.

Source: [Greylock](https://greylock.com/greymatter/how-resolve-ai-is-building-agents-to-keep-the-worlds-software-running/), [TechFundingNews](https://techfundingnews.com/resolve-ai-125m-series-a-1b-valuation/)

---

### Core Product: AI SRE Platform

Resolve AI's flagship product is an **autonomous multi-agent SRE system** that handles the full incident lifecycle:

#### 1. Alert Triage
- Correlates alerts across services automatically
- Filters noise, ranks issues by severity and business impact
- Begins investigation _before_ a human even looks at the alert

#### 2. Investigation Planning (Parallel Hypothesis Generation)
- The system does not investigate linearly — it identifies all plausible root causes simultaneously
- Spins up **specialized sub-agents** to investigate each hypothesis in parallel
- Each hypothesis is validated against real evidence (not speculation)

#### 3. Evidence Gathering
- Pulls and correlates data across **logs, metrics, traces, and dashboards**
- Integrates with existing observability stacks (Datadog, Splunk, Grafana, etc.)
- Connects to code repositories (GitHub), infrastructure tools (Kubernetes, AWS), and security tooling

#### 4. Root Cause Identification
- Maps dependency chains across services
- Constructs event timelines with confidence scoring
- Outputs an **evidence-backed explanation** of what happened, not just a data dump

#### 5. Remediation Generation
- Generates Git PRs for code fixes
- Produces `kubectl` commands for Kubernetes issues
- Outputs Terraform/config scripts for infrastructure changes
- Grounded in root cause + historical incident patterns

#### 6. Documentation & Communication
- Auto-generates incident reports
- Updates ticketing systems (Jira, ServiceNow)
- Communicates via Slack throughout the investigation

#### 7. Learning & Memory
- Analyzes historical incident patterns
- Incorporates existing runbooks
- Retains knowledge to avoid repeated mistakes across future incidents

Source: [resolve.ai/product/ai-sre](https://resolve.ai/product/ai-sre), [Introducing Resolve AI blog](https://resolve.ai/blog/introducing-resolve-ai)

---

### Technical Architecture

Resolve AI's system has three primary architectural layers:

#### Live Knowledge Graph
The platform continuously builds and updates a **live knowledge graph** of how a company's infrastructure actually works. This includes:
- Service topology and dependencies
- Deployment pipeline state
- Configuration data
- Infrastructure resources (cloud services, containers, networking)

This graph is the substrate for reasoning — not a static map, but a continuously-updated model that reflects current production state.

#### RAG + Policy-Aware Agents
Under the hood, the system combines:
- **Retrieval-Augmented Generation (RAG):** grounds LLM reasoning on customer runbooks, past incident data, and topology graphs
- **Policy-aware agents:** enforce change windows, approval requirements, rollback logic, and compliance constraints before taking action
- **Tool-using agents:** the system natively operates AWS console, Kubernetes API, GitHub, and Slack as agent tools

#### OpenTelemetry Foundation
Because the founders co-created OpenTelemetry, the platform has deep OTel integration as a first-class concern. The system can ingest OTel signals natively and correlate across the full observability signal types (traces, metrics, logs, events).

#### Agentic Positioning: Human-on-the-Loop
Resolve AI explicitly positions itself as shifting from "human-in-the-loop" (human approves every step) to **"human-on-the-loop"** supervision (human oversees but agents act first). The AI SRE is the _first responder_, not an assistant to the first responder.

The stated goal is **80% of alerts resolved without human intervention** — with humans stepping in only for novel, high-impact, or approval-gated situations.

Source: [Lightspeed thesis](https://lsvp.com/stories/building-the-ai-for-production-our-investment-in-resolve-ai/), [AI SRE glossary](https://resolve.ai/glossary/what-is-ai-sre)

---

### Customer Traction & Case Studies

Resolve AI deployed with major enterprise customers within its first year:

| Customer | Result |
|----------|--------|
| **Coinbase** | 73% faster root cause identification; 72% reduction in critical incident investigation time |
| **DoorDash** | 87% faster incident investigations in advertising operations |
| **Zscaler** | 30% reduction in engineers per incident; RCA for 150K alerts in minutes |
| **Blueground** | 4x faster triage time |
| **UNI** | 2x developer productivity increase |

Other named enterprise customers: DataStax, Salesforce, MongoDB, MSCI.

The headline outcome Resolve markets: **up to 5x faster MTTR** and **75% higher productivity** for on-call engineers, saving approximately 20 hours/week per engineer.

Source: [Lightspeed](https://lsvp.com/stories/building-the-ai-for-production-our-investment-in-resolve-ai/), [SiliconANGLE](https://siliconangle.com/2026/02/04/resolve-ai-raises-125m-1b-valuation-automate-application-maintenance/)

---

### Integrations

The platform integrates across the full production stack:

**Observability:** Datadog, Splunk, Grafana, OpenTelemetry-native
**Infrastructure:** AWS, Kubernetes (kubectl), Terraform, cloud providers
**Code:** GitHub (PR generation, code analysis, deployment context)
**Communication:** Slack (alerts, investigation updates, approvals)
**Ticketing:** Jira, ServiceNow (auto-generated incident reports)
**Security:** Cybersecurity tools (unnamed, for alert enrichment)

---

### Enterprise Security & Compliance

- SAML SSO + RBAC + administrative controls
- Data redaction, encryption, and retention management
- Customer data isolation (multi-tenant safe)
- Activity and support access logging
- **SOC 2 Type II** certified
- **GDPR** and **HIPAA** compliant

Source: [resolve.ai homepage](https://resolve.ai/)

---

### Business Model

- **Pricing:** Six- and seven-figure ACVs (enterprise contracts), per Lightspeed thesis
- **Target buyer:** Engineering/SRE leadership at mid-to-large tech, fintech, and enterprise software companies
- **Go-to-market:** Direct enterprise sales (reflected in named customers: Coinbase, DoorDash, Salesforce)
- The $125M Series A will fund GTM expansion and development of **custom AI models** for expanded automation capabilities

---

### Competitive Landscape

The AI ops / autonomous SRE space is becoming crowded:

| Player | Approach | Differentiation |
|--------|----------|-----------------|
| **Resolve.ai** | Purpose-built autonomous SRE | OTel founders, multi-agent parallel hypotheses, live knowledge graph |
| **Datadog Bits AI** | Integrated AI SRE within Datadog | Deep data lock-in advantage; AI trained on Datadog telemetry |
| **PagerDuty SRE Agent** | AI agents within Operations Cloud | Vendor-agnostic, strong governance messaging, existing enterprise relationships |
| **Incident.io** | AI-assisted incident management | UX-focused, newer entrant, more collaborative than autonomous |
| **Dynatrace Davis AI** | AIOps within monitoring platform | Deterministic AI, causation-focused, older generation approach |

**Key competitive dynamics:**
- Datadog and PagerDuty are bundling AI SRE into existing products — convenience but potential lock-in
- Resolve.ai's OTel-native approach is a hedge against vendor lock-in: works across any stack
- Established vendors have data advantages (years of customer telemetry to train on); Resolve has architectural flexibility
- The "agentic" positioning (autonomous action vs. recommendations) is a genuine differentiator from older AIOps tools

Source: [dash0.com](https://www.dash0.com/comparisons/ai-powered-observability-tools), [Medium/Amit](https://cloudedponderings.medium.com/the-rise-of-ai-sre-tools-and-platforms-the-age-of-autonomous-reliability-9575c11676df)

---

### Market Thesis

**The core problem Lightspeed and Greylock are funding:**

Engineers spend ~70% of their time on production maintenance rather than building features. As AI code generation accelerates (more code shipped faster), this ratio gets _worse_ before it gets better — more code = more services = more failure modes = more on-call burden.

The traditional response was "hire more SREs." But SRE talent is scarce and expensive. The AI-native response is: automate the investigation and remediation workflows entirely.

**Macro tailwinds:**
1. AI code generation increasing software complexity faster than SRE headcount can scale
2. Cloud-native microservices architecture makes incident investigation cognitively overwhelming
3. Tribal knowledge problem — critical operational expertise locked in senior engineers' heads
4. On-call burnout driving engineer attrition at high-growth companies

**Long-term vision (Spiros Xanthos):** AI agents perform all engineering tasks (coding, debugging, operations). Humans operate at higher abstraction levels — pure creative/product work. 100x productivity acceleration industry-wide.

Source: [Greylock thesis](https://greylock.com/greymatter/how-resolve-ai-is-building-agents-to-keep-the-worlds-software-running/)

---

### Hacker News Reception

Resolve AI launched on Hacker News (October 2024, Show HN: "Resolve AI – Your AI Production Engineer"). The reception was notable — the thread generated significant discussion about:
- Skepticism about autonomous remediation without human approval
- Interest in the parallel hypothesis investigation approach
- Questions about hallucination risk when LLMs reason about infra
- Comparisons to earlier-generation AIOps tools that promised but didn't deliver

Source: [HN thread](https://news.ycombinator.com/item?id=41712089)

---

## Open Questions

1. **Hallucination risk in remediation:** How does Resolve handle cases where the AI generates a "fix" that is confidently wrong? What rollback mechanisms exist for auto-applied remediations? This is the highest-stakes failure mode.
2. **Custom model development:** The Series A announcement mentioned building custom AI models. What architecture? Fine-tuning general LLMs vs. purpose-built smaller models?
3. **Scope of autonomous action:** What percentage of customers allow fully autonomous remediation vs. requiring human approval gates? The public metrics focus on investigation speed, not remediation automation rates.
4. **OTel vs. vendor-native data:** Does the OTel-native approach actually outperform Datadog AI trained on its own telemetry? The data quality advantage of native vendors may be underappreciated.
5. **Competitive moat durability:** Datadog and PagerDuty are shipping their own AI SRE products. How defensible is Resolve's position given the large players' distribution advantages?
6. **SWE + SRE convergence:** As AI agents increasingly both write and maintain code, is there a product opportunity to unify "write" and "operate" in one agent? Resolve mentions "production-aware coding" as a future use case.
7. **Cost model at scale:** Auto-investigation of 150K alerts (Zscaler) involves massive LLM API calls. How does the economics work at enterprise scale without custom models?

---

## Extracted Principles

No new principle files created for this research — Resolve.ai is primarily a product/market analysis rather than a source of novel technical patterns. Relevant existing principles:

- **principles/ai-llm-integration.md** — multi-agent workflow patterns apply to Resolve's parallel hypothesis architecture
- **principles/agent-task-orchestration.md** — Resolve's investigation pipeline mirrors the coordinator/worker patterns documented there
- **principles/real-time-event-driven.md** — incident response ingestion patterns relevant to building similar systems
