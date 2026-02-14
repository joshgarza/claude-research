# DevOps & Infrastructure Principles (2026)

## Summary
Opinionated, practical guidance for DevOps and infrastructure engineering in 2026. Covers IaC, CI/CD, containers, deployment strategies, GitOps, platform engineering, security, observability, cost management, and incident response.

## Principles

### GitOps for Deployment
- **What:** Git is the single source of truth for infrastructure and app state. A GitOps operator (ArgoCD or Flux) continuously reconciles cluster state to match Git. All changes go through PRs with review and audit trail.
- **Why:** 64% adoption, 81% report higher reliability and faster rollback. Self-healing — manual drift is automatically reverted. Full audit trail via Git history.
- **When:** Any Kubernetes-based deployment. Can be adapted for non-K8s with tools like Flux's notification controller.
- **When NOT:** Simple single-service deployments where git-push-to-deploy (Railway, Vercel) is sufficient.
- **Source:** [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md)

### Platform Engineering Over DevOps Teams
- **What:** Build self-service internal developer platforms (IDPs) with golden paths instead of centralized DevOps teams that become bottlenecks. Platform teams are "engineers for engineers." Measure developer experience (onboarding time, time-to-first-deploy) not just DORA metrics.
- **Why:** Gartner: 80% of large orgs will have platform teams by 2026. Centralized DevOps doesn't scale — shared responsibility becomes "nobody's responsibility."
- **When:** Organizations with >20 engineers or >5 teams. Start with self-service CI/CD templates and standard Dockerfiles before investing in Backstage.
- **When NOT:** Small teams (<10 engineers) where everyone can reasonably understand the full stack.
- **Source:** [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md)

### IaC Everything
- **What:** All infrastructure defined in code. Terraform/OpenTofu for multi-cloud, Pulumi for TypeScript/Python teams wanting native testing, SST v3 for serverless TypeScript on AWS. No manual console changes ever.
- **Why:** Reproducibility, auditability, code review for infra changes, drift detection. "If you can't script it, you can't scale it."
- **When:** Every production environment.
- **When NOT:** Rapid prototyping in a sandbox account. But codify before it reaches staging.
- **Source:** [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md)

### Supply Chain Security Is Mandatory
- **What:** SBOM generation (Syft/Trivy), SLSA build attestation, artifact signing (Sigstore/cosign), dependency auditing (`npm audit`/Snyk/Socket.dev) in CI. Pin dependencies to exact versions. Scan container images. Add behavioral analysis (Socket.dev) to catch threats CVE scanning misses.
- **Why:** Supply chain attacks doubled — costs approaching $80B by 2026. Third-party breaches now 30% of all incidents (up from 15%). Malicious packages up 220% YoY. SBOM is now a CISA regulatory requirement for federal software. Organizations with SBOMs achieve 264-day faster remediation. Code signing certificate validity capped at 460 days (March 2026, CA/B Forum).
- **When:** Every production application. Integrate into CI from day one.
- **Source:** [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md), [research/2026-02-14-devops-infrastructure-update.md](../research/2026-02-14-devops-infrastructure-update.md)

### Secrets Manager, Not .env Files
- **What:** Use Doppler or Infisical (SaaS) or Vault (self-hosted) for secrets. Inject at runtime, not build time. Never share `.env` files over Slack. Never commit secrets to Git.
- **Why:** `.env` files have no audit trail, no access control, no rotation. Sharing over Slack breaks least privilege. Secrets managers provide encrypted storage, RBAC, audit logs, and automatic rotation.
- **When:** Every application with any secrets (API keys, database URLs, tokens).
- **Source:** [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md)

### Progressive Delivery
- **What:** Canary deployments with automated metric gates for critical services. Feature flags (LaunchDarkly, Unleash, Flagsmith) to decouple deploy from release. Argo Rollouts or Flagger for Kubernetes.
- **Why:** Reduces blast radius of bad deploys. Automatic rollback on metric degradation. Feature flags enable trunk-based development and instant kill switches.
- **When:** High-traffic services, critical user paths. Feature flags for any team practicing trunk-based development.
- **When NOT:** Low-traffic internal tools where rolling deploys are sufficient.
- **Source:** [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md)

### Docker for Dev, Podman for Prod
- **What:** Use Docker Desktop for local development (better DX, ecosystem). Use Podman for CI and production (rootless by default, daemonless, native SELinux, smaller attack surface). Both are OCI-compliant — same images work on both.
- **Why:** Docker's daemon runs as root by default, creating an attack surface. Podman eliminates this with fork/exec architecture and user namespace isolation.
- **When:** Security-sensitive environments, shared CI runners, enterprise/compliance contexts for Podman. Developer workstations for Docker.
- **Source:** [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md)

### Right-Size Your Orchestration
- **What:** Start simple, add complexity only when scale demands it. Railway/Render (PaaS) → Cloud Run/Fargate (serverless containers) → Kubernetes (full orchestration). Coolify for self-hosted PaaS.
- **Why:** Kubernetes is powerful but has massive operational overhead. Most teams don't need it. 50%+ of container deployments now use serverless management (Fargate/Cloud Run).
- **When:** PaaS for small teams. Serverless containers for growing teams. Kubernetes only when you have multiple teams, services, and dedicated platform expertise.
- **Source:** [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md)

### Alert on Symptoms, Not Causes
- **What:** SLO-based alerting. Alert on "error rate > 1%" not "CPU > 80%." Runbooks for every alert. Tiered severity. Blameless postmortems after every incident.
- **Why:** CPU spikes don't always affect users. High error rates always do. Alert fatigue from noisy alerts causes real incidents to be missed.
- **When:** Every production service with monitoring.
- **Source:** [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md)

### FinOps from Day One
- **What:** Tag all resources by team/service/environment. Rightsize instances. Spot instances for fault-tolerant workloads. Shut down dev/staging off-hours. Track cost per deployment with tools like Infracost, Vantage, or CloudZero. Pre-deployment cost gates to block services exceeding thresholds.
- **Why:** 30-40% of cloud spend is wasted. Without cost visibility, teams have no incentive to optimize. Infracost in CI shows "this Terraform change costs $X/month" before merge. Platform engineering predictions: FinOps becoming a hard requirement with AI-specific budgets for token/inference costs.
- **When:** Any cloud deployment. The longer you wait, the harder it is to retrofit tagging and visibility.
- **Source:** [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md), [research/2026-02-14-devops-infrastructure-update.md](../research/2026-02-14-devops-infrastructure-update.md)

### AI Amplifies, Doesn't Fix
- **What:** DORA 2025 shows AI adoption correlates with higher throughput AND higher instability. AI amplifies existing dynamics — strong teams improve, struggling teams get worse. Platform quality is the differentiator.
- **Why:** 90% of tech professionals use AI. But teams adopting AI without strong platform foundations see performance harm — more change failures, increased rework, longer recovery times.
- **When:** Before any AIOps or AI-assisted DevOps adoption. Fix your platform, CI/CD, and observability foundations first.
- **When NOT:** Don't use this as an excuse to avoid AI entirely. The throughput gains are real — but only with the right foundations.
- **Source:** [research/2026-02-14-devops-infrastructure-update.md](../research/2026-02-14-devops-infrastructure-update.md)

### Policy-as-Code for Governance
- **What:** Use OPA/Gatekeeper for complex compliance logic, Kyverno for Kubernetes-native YAML policies, Kubernetes ValidatingAdmissionPolicy (CEL) for simple admission. Checkov/Terrascan for pre-deployment IaC scanning. Make non-compliant deployments technologically impossible.
- **Why:** AI-generated infrastructure code needs automated guardrails. Compliance requirements (SOC 2, PCI-DSS, HIPAA) are escalating. Manual review doesn't scale. "Governance by default" is becoming a platform engineering baseline.
- **When:** Any Kubernetes environment, any IaC pipeline, any regulated industry. Start with Kyverno for easy wins (require labels, enforce limits), add OPA for complex logic.
- **When NOT:** Very early-stage projects with a single developer. But adopt before reaching staging environments.
- **Source:** [research/2026-02-14-devops-infrastructure-update.md](../research/2026-02-14-devops-infrastructure-update.md)

### eBPF Is the Networking Layer
- **What:** Cilium (CNCF graduated) replaces iptables with eBPF-powered networking. Hubble provides distributed network observability without sidecars. Tetragon adds kernel-level runtime security enforcement. Operates at L3/4 and L7 (HTTP, gRPC, Kafka).
- **Why:** 10x+ throughput over iptables. Deep kernel-level visibility without application instrumentation. Replaces sidecar-based service mesh for many observability use cases. Adopted by major cloud providers as default CNI.
- **When:** Any Kubernetes deployment. Evaluate Cilium as your CNI. Add Tetragon for runtime security beyond container scanning.
- **When NOT:** Non-Kubernetes environments (eBPF is Linux kernel-level, not applicable to serverless/PaaS).
- **Source:** [research/2026-02-14-devops-infrastructure-update.md](../research/2026-02-14-devops-infrastructure-update.md)

### OpenTelemetry Is Non-Negotiable
- **What:** Instrument with OpenTelemetry from day one. OTel provides vendor-neutral APIs and semantic conventions for metrics, logs, traces, and (emerging) profiling. Stay vendor-portable — switch backends without re-instrumenting.
- **Why:** 39% commit growth in 2025, #2 CNCF project by velocity, contributors grew 35%. De facto standard. Cost fatigue is driving portability — OTel lets you switch from Datadog to open-source (LGTM stack, SigNoz) without rewriting instrumentation.
- **When:** Every application, from day one. Profiling (~20% adoption) is the emerging 4th signal — adopt if performance-sensitive.
- **When NOT:** No exceptions. Even simple apps benefit from basic telemetry.
- **Source:** [research/2026-02-14-devops-infrastructure-update.md](../research/2026-02-14-devops-infrastructure-update.md)

### Watch Wasm, Don't Adopt Broadly
- **What:** WebAssembly + WASI offers 50x lighter compute than containers with sub-millisecond cold starts. WASI 0.3.0 releasing Feb 2026, 1.0 targeting late 2026. Viable today for edge functions, plugin systems, and lightweight microservices.
- **Why:** Stronger isolation than containers by default. Language-agnostic sandboxing. But tooling, debugging, and library support aren't mature for general-purpose use yet.
- **When:** Edge functions, plugin/extension systems, multi-tenant platforms. Track wasmCloud, SpinKube, Fermyon Spin.
- **When NOT:** General-purpose workloads, complex applications with many dependencies, anything requiring mature debugging tools. Wait for WASI 1.0.
- **Source:** [research/2026-02-14-devops-infrastructure-update.md](../research/2026-02-14-devops-infrastructure-update.md)

## Revision History
- 2026-02-13: Initial extraction from [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md).
- 2026-02-14: Added AI Amplifies, Policy-as-Code, eBPF, OpenTelemetry, Wasm principles. Updated FinOps and Supply Chain Security with new data. Source: [research/2026-02-14-devops-infrastructure-update.md](../research/2026-02-14-devops-infrastructure-update.md).
