---
date: 2026-02-14
topic: "DevOps & Infrastructure Practices 2026: Update"
status: complete
tags: [devops, infrastructure, IaC, ci-cd, containers, kubernetes, deployment, security, observability, platform-engineering, gitops, cloud, aiops, ebpf, wasm, policy-as-code]
related: [2026-02-13-devops-infrastructure-practices.md, 2026-02-13-backend-api-practices.md, 2026-02-13-engineering-sources-guide.md]
---

# DevOps & Infrastructure Practices 2026: Update

## Context
Update to the 2026-02-13 research based on new data from CNCF's 2025 Annual Survey, the DORA 2025 report, Kubernetes 1.35 release, and emerging developments in AIOps, Policy-as-Code, eBPF, and Wasm. This file covers **what changed** since the initial research — refer to the original for foundational material.

Sources prioritized per [engineering sources guide](2026-02-13-engineering-sources-guide.md): CNCF blog (T1), Kubernetes blog (T1), DORA (T1), Cloudflare blog (T2), The New Stack (T2), platformengineering.org (T2), Spacelift (T2), Northflank (T2). SEO-farm sources used only for cross-referencing claims.

---

## 1. New Data: CNCF 2025 Annual Survey

The definitive reality check on cloud-native adoption. Published January 2026.

| Metric | 2025 Value | Prior | Trend |
|---|---|---|---|
| **K8s production use** (among container users) | 82% | 66% (2023) | Steady growth |
| **Cloud-native adoption** (any technique) | 98% | ~95% (2023) | Near-universal |
| **"Much/nearly all" cloud-native** | 59% | — | Majority are deep in |
| **K8s for AI inference** | 66% of AI adopters | — | K8s = AI platform |
| **GitOps (innovators)** | 58% extensive | 23% (adopters) | Gap between leaders and laggards |
| **Top challenge** | Culture (47%) | Technical complexity | Shifted from technical to organizational |
| **Profiling in observability** | ~20% | — | Emerging signal type |

**Key insight:** The biggest barrier to cloud-native is no longer technical — it's cultural. 47% cite "cultural changes with the development team" as the #1 challenge. Training (36%) and security (36%) are secondary.

Source: [CNCF 2025 Annual Survey](https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/)

---

## 2. New Data: DORA 2025 Report

Major methodological shift. The most significant DORA update in years.

### Five Metrics (Not Four)
DORA now tracks 5 metrics:
1. **Deployment frequency** (throughput)
2. **Lead time for changes** (throughput)
3. **Change failure rate** (stability)
4. **Failed deployment recovery time** (stability — renamed from MTTR)
5. **Reliability** (new — operational performance meeting targets)

### Seven Team Archetypes (Not Four Tiers)
DORA dropped the "Elite/High/Medium/Low" performance tiers. New framework: **seven team archetypes** that blend delivery performance with human factors — burnout, friction, and perceived value. Friction and burnout are now equally weighted with delivery speed.

### The AI Paradox
- **90% of tech professionals** now use AI in their work.
- AI adoption correlates with **higher throughput** — teams move faster.
- AI adoption also correlates with **higher instability** — more change failures, increased rework, longer cycle times to resolve.
- **AI amplifies existing dynamics.** High-performing orgs get better. Struggling orgs get worse.
- **Platform quality is the differentiator.** Teams adopting AI without strong platform foundations see performance harm.

### Platform Engineering Validated
- **90% of organizations** now have internal platforms.
- **75%** have dedicated platform teams.
- Platform quality (not just existence) determines whether AI adoption helps or hurts.

Source: [DORA 2025 Report](https://dora.dev/research/2024/dora-report/), [DevOps.com Analysis](https://devops.com/dora-2025-faster-but-are-we-any-better/), [Faros AI Analysis](https://www.faros.ai/blog/key-takeaways-from-the-dora-report-2025)

---

## 3. Kubernetes 1.35 ("Timbernetes")

Released December 2025. 60 enhancements: 17 GA, 19 beta, 22 alpha.

### Headline: In-Place Pod Resize → GA
After 6+ years in development (alpha in v1.27, beta in v1.33), **in-place pod resource updates** are now GA. CPU and memory requests/limits are mutable on running pods without restart. This is a fundamental shift — previously you had to delete and recreate pods to change resource allocation.

**Practical impact:**
- VPA can adjust resources without disruption.
- Autoscaling becomes seamless — no pod restarts for resource changes.
- Significant for AI/GPU workloads where pod recreation is expensive.

### AI/ML First-Class Support
K8s 1.35 adds multiple features targeting AI workloads:
- **Gang Scheduling** (alpha) — Ensures a group of pods (e.g., distributed training job) are all scheduled together or not at all. New `PodGroup` API resource.
- **DRA Enhancements** (alpha) — Device binding conditions defer pod binding until GPUs are confirmed ready. Partitionable devices allow dynamic GPU partitioning.
- **Extended Toleration Operators** (alpha) — Numeric comparison (Lt, Gt) for taints/tolerations, enabling SLA-aware scheduling on spot/preemptible nodes.

### Other Notable Features
- **Container Restart Rules** → beta. More granular control over restart behavior.
- **StatefulSet maxUnavailable** → beta (enabled by default). Batch updates for faster rollouts.
- **Opportunistic Batching** for scheduler → beta. Better scheduling efficiency.
- **Mixed Version Interoperability Proxy** (alpha) — Routes API requests correctly during cluster upgrades.
- **Ingress NGINX retirement** announced for March 2026.

Source: [Kubernetes 1.35 Release Blog](https://kubernetes.io/blog/2025/12/17/kubernetes-v1-35-release/), [platformengineering.org: K8s 1.35 Alpha Features](https://platformengineering.org/blog/kubernetes-1-35-10-new-alpha-features), [InfoQ: K8s 1.35](https://www.infoq.com/news/2025/12/kubernetes-1-35/)

---

## 4. CNCF Project Velocity Trends

Fastest-growing CNCF projects by contributor/commit growth:

| Project | Trend | Signal |
|---|---|---|
| **Kubernetes** | Largest contributor base, sustained | Foundation of everything |
| **OpenTelemetry** | 39% commit growth, contributors 1,301→1,756 (+35%) | Observability standard is accelerating |
| **Backstage** | Contributions doubled since 2024 | Platform engineering wave is real |
| **Crossplane** | Growing | Kubernetes-native IaC |
| **Kubeflow** | Growing | AI/ML workloads on K8s |

**Key signal:** OpenTelemetry's growth rate is exceptional. It's now the #2 CNCF project by velocity. This validates the "OTel is non-negotiable" stance from the original research.

Source: [CNCF Project Velocity 2025](https://www.cncf.io/blog/2026/02/09/what-cncf-project-velocity-in-2025-reveals-about-cloud-natives-future/)

---

## 5. AIOps & Self-Healing Infrastructure

The original research mentioned AI entering the pipeline. The shift in early 2026: it's going from "entering" to "expected."

### What's Happening
- **Gartner:** 60%+ of large enterprises will have self-healing systems powered by AIOps by end of 2026.
- **73% of enterprises** implementing or planning AIOps adoption by end of 2026.
- AIOps evolving from dashboards → recommendations → **agentic AI** that autonomously diagnoses, acts, and verifies fixes.

### Concrete Use Cases (Not Hype)
| Use Case | Maturity | Tools |
|---|---|---|
| **Anomaly detection** in metrics/logs/traces | Production-ready | Datadog AI, SigNoz, New Relic AI |
| **Release risk scoring** based on code changes | Early production | Harness, LinearB |
| **Automated remediation** (rollback, scale, restart) | Early production | PagerDuty AIOps, incident.io |
| **Root cause analysis** correlating across services | Emerging | Komodor, Datadog, incident.io |
| **Capacity planning** and cost optimization | Emerging | ScaleOps, CAST AI |
| **Autonomous architecture optimization** | Research/experimental | — |

### The Nuance (Per DORA)
AI in DevOps amplifies existing quality. Teams with strong platforms and practices benefit. Teams without them get worse. **Don't adopt AIOps before fixing your platform foundations.**

Source: [Talent500: DevOps Trends 2026](https://talent500.com/blog/2026-devops-trends-autonomous-pipelines-platform-engineering-ai/), [BSEtec: AIOps 2026](https://www.bsetec.com/blog/aiops-self-healing-infrastructure-in-2026/), [Ennetix: Autonomous IT Operations](https://ennetix.com/the-rise-of-autonomous-it-operations-what-aiops-platforms-must-enable-by-2026/)

---

## 6. Policy-as-Code (New Section)

Not covered in the original research. Emerging as a governance standard.

### Why Now
- Compliance requirements escalating (SOC 2, PCI-DSS, HIPAA).
- AI-generated infrastructure code needs automated guardrails.
- Platform engineering requires "governance by default" — non-compliant deployments should be technologically impossible.

### The Two Leaders

| | OPA (Gatekeeper) | Kyverno |
|---|---|---|
| **Policy language** | Rego (custom DSL, powerful but learning curve) | YAML (Kubernetes-native, familiar) |
| **Scope** | General-purpose (K8s, APIs, CI/CD, microservices) | Kubernetes-specific |
| **Capabilities** | Complex logic, data transforms, external API integration | Validation, mutation, resource generation |
| **Best for** | Complex compliance logic, cross-system policies | Straightforward K8s policies (labels, limits, configs) |
| **CNCF status** | Graduated | Incubating |

**Recommended pattern:** Use both together. Kyverno for straightforward validation/mutation (require labels, enforce resource limits, generate ConfigMaps). OPA for complex compliance logic and external data integration.

### Kubernetes Native: ValidatingAdmissionPolicy (CEL)
- Built into Kubernetes since v1.30 (GA).
- Uses Common Expression Language (CEL) — no external controllers needed.
- Best for simple, object-scoped validation.
- Complements (doesn't replace) OPA/Kyverno for complex scenarios.

### Pre-Deployment Scanning
| Tool | What | Best For |
|---|---|---|
| **Checkov** | Static analysis of Terraform, CloudFormation, K8s | Shift-left IaC security. CIS, NIST, PCI-DSS, HIPAA built-in. |
| **Terrascan** | Static analysis of multiple IaC frameworks | Scalable open-source scanning. |
| **Infracost** | Cost estimation in CI | "This Terraform change costs $X/month" before merge. |

Source: [Spacelift: Policy as Code Tools 2026](https://spacelift.io/blog/policy-as-code-tools), [oneuptime: Kyverno + OPA](https://oneuptime.com/blog/post/2026-02-09-policy-as-code-kyverno-opa/view), [platformengineering.org: Predictions 2026](https://platformengineering.org/blog/10-platform-engineering-predictions-for-2026)

---

## 7. eBPF & Cilium (New Section)

Not covered in the original research. Becoming the cloud-native networking and security standard.

### What eBPF Enables
eBPF (Extended Berkeley Packet Filter) allows programs to run inside the Linux kernel without modifying kernel source code. For infrastructure, this means:
- **High-performance networking** — Replace iptables with eBPF-powered packet processing. 10x+ throughput improvements.
- **Deep observability** — Kernel-level visibility into every syscall, network connection, and file access without application instrumentation.
- **Runtime security** — Detect and prevent attacks at the kernel level, not the application level.

### Cilium: The eBPF Platform
Cilium is the CNCF-graduated project that makes eBPF practical for Kubernetes:
- **CNI (Container Network Interface)** — Replaces iptables with eBPF for networking. Adopted by major cloud providers.
- **Hubble** — Distributed networking observability built on Cilium. Deep visibility into service communication.
- **Tetragon** — eBPF-based runtime security and enforcement. Detect and prevent container escapes, privilege escalation, file access violations.
- **Layer 3/4 + Layer 7** — Network policies at TCP/UDP level AND application protocol level (HTTP, gRPC, Kafka).

### When to Adopt
- **If running Kubernetes at any scale:** Evaluate Cilium as your CNI. It's becoming the default.
- **If you need runtime security beyond container scanning:** Tetragon provides kernel-level enforcement.
- **If you need network observability without sidecars:** Hubble replaces the need for sidecar-based service meshes for many use cases.

Source: [CNCF: Cloud Native Security with Cilium and eBPF](https://www.cncf.io/blog/2025/01/02/unlocking-cloud-native-security-with-cilium-and-ebpf/), [Cilium.io](https://cilium.io/), [oneuptime: eBPF Cilium K8s Networking](https://oneuptime.com/blog/post/2026-01-07-ebpf-cilium-kubernetes-networking/view)

---

## 8. WebAssembly / WASI (New Section)

Not covered in the original research. Approaching production readiness as a container alternative.

### The Promise
WebAssembly (Wasm) + WASI (WebAssembly System Interface) offers a new compute primitive:
- **50x lighter** than Docker containers.
- **Cold starts under 1ms** (vs. seconds for containers).
- **Language-agnostic sandboxing** — stronger isolation than containers by default.
- **Portable** — run anywhere a Wasm runtime exists (edge, cloud, embedded).

### Current State (February 2026)
- **WASI 0.3.0** releasing imminently (Feb 2026). Adds language-integrated concurrency and high-performance streaming.
- **WASI 1.0** expected by end of 2026 or early 2027.
- **wasmCloud** (CNCF sandbox) — orchestration for Wasm components. Adobe uses it to optimize K8s estate.
- **SpinKube** — Run Spin (Wasm) apps on Kubernetes alongside containers.
- **Fermyon Spin** — Developer-friendly Wasm runtime for serverless functions.

### Practical Assessment
Wasm will **not** replace Docker or Kubernetes in 2026 — despite clickbait headlines claiming otherwise. But it's becoming viable for:
- **Edge functions** — Where cold start time matters (Cloudflare Workers already uses V8 isolates, a similar concept).
- **Plugin systems** — Sandboxed plugins for applications (Envoy Wasm filters, Kubernetes admission webhooks).
- **Lightweight microservices** — Where container overhead is unnecessary.
- **Multi-tenant platforms** — Where isolation guarantees matter more than compatibility.

**Watch, don't adopt broadly yet.** The ecosystem is real but the tooling, debugging, and library support aren't mature enough for general-purpose use. Track WASI 1.0 progress.

Source: [The New Stack: WASI 1.0](https://thenewstack.io/wasi-1-0-you-wont-know-when-webassembly-is-everywhere-in-2026/), [Platform Uno: State of WebAssembly 2025-2026](https://platform.uno/blog/the-state-of-webassembly-2025-2026/)

---

## 9. IaC Updates

### OpenTofu Maturing
- **CNCF Sandbox** since April 2025.
- **OpenTofu 1.9/1.10** shipping features Terraform users have requested for years:
  - Dynamic provider functions.
  - Improved loops in import blocks (bulk resource import).
  - Early variable evaluation (variables in previously locked-out config areas).
- **~3,900 providers, ~23,600 modules.** Ecosystem approaching critical mass.
- Enterprises (Fidelity and others) actively adopting for CI/CD and multi-cloud.

### Pulumi Expanding
- **HCL support** in private beta, GA expected Q1 2026. Can run existing Terraform HCL code natively.
- **Terraform state import** in private beta. Migrate Terraform state to Pulumi without rewriting.
- **150+ providers** with native Kubernetes integration.
- These moves position Pulumi as a "migrate from Terraform" path, not just a greenfield choice.

### Updated Decision Heuristic
The original heuristic still holds, with one addition:
- **Migrating from Terraform?** → Evaluate Pulumi (HCL compat + state import) or OpenTofu (drop-in fork). OpenTofu if you want minimal change. Pulumi if you want to move to TypeScript/Python long-term.

Source: [dasroot: IaC Comparison 2026](https://dasroot.net/posts/2026/01/infrastructure-as-code-terraform-opentofu-pulumi-comparison-2026/), [Pulumi: All IaC Including Terraform](https://www.pulumi.com/blog/all-iac-including-terraform-and-hcl/)

---

## 10. Supply Chain Security Escalation

The original research flagged supply chain security as "non-negotiable." New data makes the case even stronger.

### The Numbers
| Metric | Value |
|---|---|
| **Supply chain attack costs** | Doubled from $35B (2021) to projected $80B (2026) |
| **Third-party breaches** | 30% of all data breaches (up from 15%) |
| **Malicious packages** | 220% YoY increase |
| **Mean time to remediate** | Ballooned from 25 days to 470 days |
| **Open-source components** in modern apps | ~90% |
| **High-risk dependencies** | 74% of apps contain them |

### The XZ Utils Incident (2024)
The most sophisticated supply chain attack discovered. A backdoor in XZ Utils — present on billions of Linux systems — was days from reaching production globally. It appeared only in release tarballs (not source repos), exploited SSH authentication, and was invisible to traditional security tools. This is the "Shai-Hulud" moment that accelerated SBOM/SLSA adoption.

### SBOM as Regulatory Requirement
CISA's 2025 guidance mandates minimum SBOM elements for federal software procurement. Organizations implementing SBOM achieved **264-day reductions** in remediation timelines.

### Updated Recommendations
Original recommendations (SBOM, SLSA, Sigstore, dependency auditing) all still apply. New additions:
- **Code Signing Certificate validity** limited to 460 days max starting March 1, 2026 (CA/B Forum).
- **Semgrep Supply Chain** now provides reachability coverage for all critical/high CVEs back to 2017.
- **Socket.dev** — Behavioral analysis of npm/PyPI packages (detects typosquatting, install scripts, network calls). Catches threats that traditional CVE scanning misses.

Source: [Java Code Geeks: DevSecOps Supply Chain Crisis](https://www.javacodegeeks.com/2026/02/security-first-development-devsecops-and-the-supply-chain-crisis.html), [Practical DevSecOps: Trends 2026](https://www.practical-devsecops.com/devsecops-trends-2026/), [OX Security: AppSec Trends 2026](https://www.ox.security/blog/application-security-trends-in-2026/)

---

## 11. Observability Updates

### OpenTelemetry Acceleration
- **39% commit growth** in 2025. Contributors grew 35%. #2 CNCF project.
- OpenTelemetry is now the **de facto standard** for telemetry collection. Vendor-neutral APIs and semantic conventions make telemetry portable.
- **Cost fatigue** dominating observability discussions. OTel enables switching backends without re-instrumenting.
- **Profiling** (continuous profiling) emerging as the 4th signal alongside metrics, logs, traces. ~20% adoption per CNCF survey.

### LGTM Stack Advancement
The Grafana LGTM stack (Loki + Grafana + Tempo + Mimir) with OpenTelemetry:
- Tempo's `metrics_generator` now auto-generates RED metrics (rate, error, duration) from traces → pushed to Mimir. Alerting on trace-derived data without extra instrumentation.
- Full-stack observability on open-source tools, entirely OTel-native.

### LLM Observability
SigNoz investing in OTel-native LLM observability — auto-surfacing external API usage and performance based on OTel GenAI semantic conventions. New requirement for teams running AI workloads.

Source: [CNCF: Project Velocity 2025](https://www.cncf.io/blog/2026/02/09/what-cncf-project-velocity-in-2025-reveals-about-cloud-natives-future/), [CNCF: OpenTelemetry Collector vs Agent](https://www.cncf.io/blog/2026/02/02/opentelemetry-collector-vs-agent/), [oneuptime: LGTM Stack with OTel](https://oneuptime.com/blog/post/2026-02-06-lgtm-stack-opentelemetry/view), [SigNoz: LLM Observability](https://signoz.io/blog/llm-observability-opentelemetry/)

---

## 12. Platform Engineering: 2026 Predictions

Top predictions from platformengineering.org (Tier 2 source):

| Prediction | Implication |
|---|---|
| **Agentic infrastructure becomes standard** | AI agents get RBAC, resource quotas, governance. "Agent golden paths" alongside developer golden paths. |
| **Platforms become safety nets for AI-generated code** | Automated review and remediation of AI-generated infra code. |
| **Self-healing → self-architecture** | AI doesn't just fix failures — it proactively re-architects for cost/latency targets. |
| **DevOps and MLOps converge** | Single delivery pipelines for app devs, ML engineers, and data scientists. |
| **FinOps becomes a hard requirement** | Pre-deployment cost gates block services exceeding unit-economic thresholds. AI-specific budgets for token/inference costs. |
| **Compliance → governance-by-default** | Non-compliant deployments become technologically impossible (Policy-as-Code). |
| **Platform teams measure business value** | Success measured in revenue enabled, costs avoided — not just DORA metrics. |
| **Role specialization accelerates** | New titles: Head of Platform Engineering (HOPE), Platform Product Manager, DevEx Platform Engineer, Security Platform Engineer. |

Source: [platformengineering.org: 10 Predictions for 2026](https://platformengineering.org/blog/10-platform-engineering-predictions-for-2026)

---

## 13. Cloud Platform Updates

### Cloudflare Containers (Public Beta)
Cloudflare now offers containers alongside Workers:
- **Up to 400 GiB memory, 100 vCPUs, 2 TB disk** per deployment.
- **GPU support** available.
- **Workers Builds** — integrated CI/CD built on the Workers platform (GA).
- Positioning: Run containers globally alongside edge functions. Fills the gap between "Workers for lightweight" and "need a real container."

### Self-Hosted PaaS Landscape Update
The self-hosted deployment tool space has matured:

| Tool | Architecture | Best For | GitHub Stars |
|---|---|---|---|
| **Coolify** | Web dashboard, Docker Swarm | Most features, biggest community. 280+ one-click app templates. | 50k+ |
| **Dokploy** | Web dashboard, Docker Swarm | Cleaner UI, better monitoring. Smaller community. | Growing |
| **Kamal** | CLI-first, SSH-based | Zero overhead (only app + proxy on server). Ships with Rails 8. | — |
| **Dokku** | CLI, git-push deploy | Simplest path. Single-server only. | — |
| **Komodo** | Agent-based, TOML config | Multi-server orchestration, declarative infra. | — |

**Updated heuristic:** If you want a dashboard, Coolify (most mature) or Dokploy (cleaner). If you want minimal overhead, Kamal. If you want git-push simplicity, Dokku. If you need multi-server orchestration, Komodo.

Source: [Cloudflare: Containers Public Beta](https://blog.cloudflare.com/containers-are-available-in-public-beta-for-simple-global-and-programmable/), [Haloy: Self-Hosted Tools Compared](https://haloy.dev/blog/self-hosted-deployment-tools-compared)

---

## Open Questions (Updated)

From the original research, updated with new data:

- **Platform engineering maturity** — DORA says 90% have internal platforms, 75% have platform teams. But quality varies wildly. The "platform gap" between leaders and laggards is widening.
- **OpenTofu adoption velocity** — Now CNCF Sandbox with ~3,900 providers. Ecosystem is viable. The real question: will enterprises migrate existing Terraform or only use OpenTofu for greenfield?
- **Wasm timeline** — WASI 1.0 targeting late 2026/early 2027. Will the ecosystem mature fast enough for production workloads beyond edge functions?
- **AI in DevOps guardrails** — DORA shows AI amplifies dysfunction. What guardrails prevent AI-generated infra code from increasing instability? Policy-as-Code is part of the answer.
- **eBPF vs. service meshes** — Cilium/Hubble/Tetragon may eliminate the need for sidecar-based service meshes (Istio, Linkerd) for many use cases. How fast does this happen?
- **Observability cost crisis** — Cost fatigue is the #1 topic in observability. Will OTel + open-source backends (LGTM, SigNoz) actually displace Datadog, or is the migration cost too high?

## Extracted Principles

Updates/additions to `principles/devops-infrastructure.md`:

1. **AI amplifies, doesn't fix.** DORA 2025: AI makes strong teams stronger and weak teams weaker. Fix platform foundations before adopting AIOps. (NEW)
2. **Policy-as-Code for governance.** OPA for complex logic, Kyverno for K8s-native YAML policies, CEL for simple admission. Make non-compliant deployments impossible, not just discouraged. (NEW)
3. **eBPF is the networking layer.** Cilium replaces iptables. Hubble replaces sidecar-based observability. Tetragon adds kernel-level runtime security. Evaluate if running K8s. (NEW)
4. **OpenTelemetry is non-negotiable.** 39% commit growth, #2 CNCF project. Instrument with OTel from day one. Stay vendor-portable. Profiling is the emerging 4th signal. (UPDATED — now backed by CNCF velocity data)
5. **Watch Wasm, don't adopt broadly.** WASI 1.0 targeting late 2026. Viable for edge functions and plugin systems. Not ready to replace containers for general workloads. (NEW)
6. **Supply chain security is worsening.** Attacks doubled, costs approaching $80B. SBOM is now regulatory. Add behavioral analysis (Socket.dev) alongside CVE scanning. (UPDATED — stronger evidence)
7. **In-place pod resize changes K8s operations.** GA in K8s 1.35. No more pod recreation for resource changes. Enables seamless VPA and cost optimization. (NEW)
8. **Cloudflare is a full platform now.** Workers + Containers + D1 + R2 + Builds. Viable alternative to traditional cloud for many workloads. (NEW)

> Principles to be merged into `principles/devops-infrastructure.md`
