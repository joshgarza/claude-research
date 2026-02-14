---
date: 2026-02-13
topic: DevOps & Infrastructure Best Practices 2026
status: complete
tags: [devops, infrastructure, IaC, ci-cd, containers, kubernetes, deployment, security, observability, platform-engineering, gitops, cloud]
related: [2026-02-13-backend-api-practices.md, 2026-02-13-frontend-engineering-practices.md]
---

# DevOps & Infrastructure Best Practices 2026

## Context
Comprehensive survey of DevOps and infrastructure engineering in 2026 — Infrastructure as Code, CI/CD, containers, deployment strategies, platform engineering, security, observability, cost management, and incident response. Complements the backend research (which covered deployment models lightly) with deep infrastructure focus.

---

## 1. The Big Picture: DevOps in 2026

### Five Macro Shifts

1. **Platform Engineering replaces "DevOps teams."** Centralized DevOps becomes a bottleneck at scale. Platform teams build self-service internal developer platforms (IDPs) with golden paths. Gartner: 80% of large orgs will have platform teams by 2026 (up from 45% in 2022).

2. **GitOps is the deployment model.** Git as single source of truth for infrastructure and app state. 64% adoption, 81% report higher reliability and faster rollback.

3. **AI enters the pipeline.** AIOps for anomaly detection, predictive testing, autonomous remediation. AI-powered incident management reduces MTTR by 17-70%.

4. **Supply chain security is non-negotiable.** SBOM, SLSA, artifact signing (Sigstore), dependency auditing. The "Shai-Hulud" npm attack (2025) accelerated adoption.

5. **FinOps connects cost to engineering.** 30-40% of cloud spend is wasted. Cost visibility per deployment, per feature, per team is now expected.

Sources: [Growin: Platform Engineering 2026](https://www.growin.com/blog/platform-engineering-2026/), [Talent500: DevOps Trends 2026](https://talent500.com/blog/2026-devops-trends-autonomous-pipelines-platform-engineering-ai/), [RealVNC: DevOps Trends](https://www.realvnc.com/en/blog/devops-trends/)

---

## 2. Infrastructure as Code

### The Three Contenders

| | Terraform | OpenTofu | Pulumi |
|---|---|---|---|
| **License** | BSL (proprietary) | MPL 2.0 (open source, CNCF) | Apache 2.0 |
| **Language** | HCL (declarative DSL) | HCL (same as Terraform) | TypeScript, Python, Go, C#, Java |
| **Market share** | 32.8% (leader) | Growing (Terraform fork) | Smaller but growing |
| **Provider ecosystem** | Largest (150+) | Compatible with Terraform providers | 150+ (growing) |
| **Testing** | External only (Terratest) | External only (Terratest) | Native (Jest, pytest, Go testing) |
| **State management** | Self-managed or Terraform Cloud | Self-managed or S3/Azure Blob | Pulumi Cloud or self-managed, built-in concurrency |
| **Execution time (500 resources)** | 125 sec | 132 sec | 89 sec |
| **Scalability** | 450 resources | 440 resources | 520 resources |

### Decision Heuristic

- **Multi-cloud enterprise with established workflows?** → Terraform. Largest ecosystem, most mature.
- **Need open-source governance / compliance (PCI-DSS, GDPR)?** → OpenTofu. Drop-in Terraform replacement, CNCF-governed.
- **TypeScript/Python team wanting native testing + dynamic logic?** → Pulumi. Write infra in languages you know, test with Jest/pytest.
- **Serverless TypeScript on AWS?** → SST v3 (Ion). Built on Pulumi + Terraform, defines AWS infra in a single `sst.config.ts`. 150+ providers. Best DX for serverless.

### SST v3 (Ion)

SST v3 deserves special mention for TypeScript teams:
- Defines entire AWS infrastructure in TypeScript (`sst.config.ts`).
- Built on Pulumi and Terraform (not CDK/CloudFormation like v2).
- Unified local dev environment: deploys app via watcher, runs functions Live, creates VPC tunnel, starts frontend + backend together.
- 150+ providers (not just AWS).
- Best-in-class DX for serverless — databases, buckets, queues, Stripe webhooks, all version-controlled and repeatable.

### IaC Best Practices

- **Everything in code.** If you can't script it, you can't scale it. No manual console changes.
- **Modular structure.** Reusable modules for common patterns (VPC, database, queue). Share via registries.
- **State management.** Remote state (S3 + DynamoDB locking for Terraform, Pulumi Cloud for Pulumi). Never local state in production.
- **Drift detection.** Regularly `plan`/`preview` to detect manual changes. Auto-remediate or alert.
- **Secrets in IaC.** Never hardcode. Use references to Vault/AWS Secrets Manager/Doppler.

Sources: [dasroot: IaC Comparison 2026](https://dasroot.net/posts/2026/01/infrastructure-as-code-terraform-opentofu-pulumi-comparison-2026/), [SST docs](https://sst.dev/docs/), [Pulumi: IaC tools](https://www.pulumi.com/blog/infrastructure-as-code-tools/)

---

## 3. CI/CD Pipelines

### The Standard Pipeline (GitHub Actions)

```
push/PR → lint + typecheck (fast) → unit tests → build → deploy preview → integration/E2E tests → merge → deploy staging → deploy production (with approval gate)
```

### Pipeline Design Principles

| Principle | Practice |
|---|---|
| **Fail fast** | Run fastest checks first: lint → typecheck → unit → integration → E2E |
| **Cache everything** | Dependencies (pnpm store), build artifacts, Docker layers, test fixtures, Playwright browsers |
| **Parallel by default** | Independent jobs run concurrently. Lint, typecheck, and unit tests are independent. |
| **Pin versions** | Pin action versions by SHA, not tag. Prevents supply chain attacks via tag rewriting. |
| **Least privilege** | Set explicit `permissions` on every workflow. Restrict `GITHUB_TOKEN` scope. |
| **Environments** | Use GitHub Environments with protection rules (required reviewers, wait timers) for production. |
| **Secrets** | Use GitHub encrypted secrets. Never echo secrets in logs. Rotate regularly. |
| **Small PRs** | 100 lines > 1000 lines. Faster review, fewer merge conflicts, easier rollback. |

### Caching Strategy

```yaml
# pnpm store
- uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: pnpm-${{ hashFiles('pnpm-lock.yaml') }}

# Turborepo remote cache
- run: turbo build --remote-cache

# Docker layer caching
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Beyond GitHub Actions

| Tool | When |
|---|---|
| **GitHub Actions** | Default for most projects. Excellent GitHub integration, marketplace, matrix builds. |
| **GitLab CI** | If you're on GitLab. Built-in container registry, security scanning. |
| **CircleCI** | Advanced caching, resource classes, complex pipeline orchestration. |
| **Dagger** | Programmable CI pipelines in TypeScript/Python/Go. Runs anywhere. Portable — not locked to one CI provider. |

Sources: [DevToolbox: GitHub Actions Guide 2026](https://devtoolbox.dedyn.io/blog/github-actions-cicd-complete-guide), [GitHub: CI/CD Best Practices](https://github.com/github/awesome-copilot/blob/main/instructions/github-actions-ci-cd-best-practices.instructions.md)

---

## 4. Containers & Orchestration

### Docker vs Podman

| | Docker | Podman |
|---|---|---|
| **Architecture** | Daemon-based (dockerd) | Daemonless (fork/exec per container) |
| **Rootless** | Supported but not default | Default, built from the ground up |
| **Security** | Root daemon = attack surface | No daemon, user namespace isolation, native SELinux |
| **OCI compliance** | Yes | Yes — same images, same registries |
| **CLI compatibility** | `docker ...` | `podman ...` (drop-in alias) |
| **Compose** | Docker Compose | `podman-compose` or Podman supports Compose files |
| **Kubernetes** | Indirect (via containerd) | Native pod concept, `podman generate kube` |
| **Ecosystem** | Larger (Docker Hub, Desktop, Scout) | Growing, Red Hat/enterprise backing |

**Recommendation:** Docker for developer workstations (better DX, Docker Desktop). Podman for CI/production/security-sensitive environments (rootless by default, no daemon, SELinux). Both use OCI images — no image rebuild needed to switch.

### Docker Best Practices (2026)

- **Multi-stage builds.** Separate build and runtime stages. Final image contains only production artifacts.
- **Minimal base images.** `alpine`, `distroless`, or `scratch`. Smaller image = smaller attack surface + faster pulls.
- **Don't run as root.** Use `USER` directive. Non-root by default.
- **Pin base image digests.** `FROM node:20-alpine@sha256:abc...` not `FROM node:20-alpine`. Prevents supply chain attacks via tag mutation.
- **Layer caching.** Order Dockerfile instructions from least to most frequently changing. `COPY package.json` before `COPY src/`.
- **Health checks.** `HEALTHCHECK CMD curl -f http://localhost:3000/health`.
- **`.dockerignore`.** Exclude `node_modules`, `.git`, `.env`, build artifacts.

### Kubernetes: When and How

**When to use Kubernetes:**
- Multiple teams, multiple services, need independent scaling.
- Complex networking, service discovery, load balancing requirements.
- Need advanced deployment strategies (canary, blue-green) at infrastructure level.

**When NOT to use Kubernetes:**
- Small team (<5 engineers), 1-3 services.
- Serverless or PaaS covers your needs.
- You don't have dedicated platform/infra expertise.

**Kubernetes simplification tools:**
- **K3s** — Lightweight Kubernetes for edge/IoT/dev. Single binary, <100MB.
- **K0s** — Zero-friction Kubernetes. Single binary, minimal dependencies.
- **Google Cloud Run / AWS Fargate** — Managed container orchestration without Kubernetes.

**Kubernetes best practices:**
- **Namespaces** for environment isolation (dev, staging, prod).
- **Resource requests and limits** on every pod. No unlimited containers.
- **Network policies** as pod-level firewalls. Deny all by default, allow specific.
- **RBAC** with least privilege. No `cluster-admin` for developers.
- **Pod security standards.** Enforce `restricted` profile in production.

Sources: [bnxt: Docker vs Podman 2026](https://www.bnxt.ai/blog/docker-vs-podman-a-complete-container-comparison-for-2026), [ThinksYS: Docker Best Practices 2026](https://thinksys.com/devops/docker-best-practices/), [Northflank: Kubernetes vs Docker](https://northflank.com/blog/kubernetes-vs-docker)

---

## 5. Deployment Strategies

### The Spectrum

| Strategy | Risk | Complexity | Rollback Speed | Best For |
|---|---|---|---|---|
| **Rolling** | Medium | Low | Moderate | Default for most services |
| **Blue-Green** | Low | Medium | Instant (traffic switch) | Stateless services, need instant rollback |
| **Canary** | Lowest | High | Fast (stop promotion) | High-traffic services, need gradual validation |
| **Progressive delivery** | Lowest | Highest | Fast | Critical services requiring metric-gated rollout |

### Progressive Delivery

The evolution of canary deployments. Traffic shifts based on metrics, not time:

1. Deploy new version to 1% of traffic.
2. Monitor error rates, latency, business metrics.
3. If metrics are healthy, automatically shift to 5% → 25% → 50% → 100%.
4. If metrics degrade, automatically roll back.

**Tools:** Argo Rollouts (Kubernetes), Flagger (with Flux/Istio), LaunchDarkly/Unleash (feature flags).

### Feature Flags

Decouple deployment from release:
- **Deploy:** Code reaches production (but may be inactive).
- **Release:** Feature becomes visible to users (flag turned on).

This separation enables:
- Ship incomplete features behind flags (trunk-based development).
- Gradual rollout by percentage, region, user segment.
- Instant kill switch — disable feature without rollback.
- A/B testing built into the deployment pipeline.

**Tools:** LaunchDarkly (managed), Unleash (open source), Flagsmith (open source), PostHog (bundled with analytics).

Sources: [Harness: Blue-Green and Canary](https://www.harness.io/blog/blue-green-canary-deployment-strategies), [Unleash: Progressive Delivery](https://www.getunleash.io/blog/blue-green-deployment-vs-progressive-delivery), [Argo Rollouts docs](https://argo-rollouts.readthedocs.io/en/stable/concepts/)

---

## 6. GitOps

### The Model

Git is the single source of truth for declarative infrastructure and application state. A GitOps operator (ArgoCD or Flux) continuously reconciles cluster state to match what's in Git.

**Core principles:**
1. **Declarative.** All infrastructure and app config expressed declaratively.
2. **Versioned.** All changes go through Git (PRs, reviews, audit trail).
3. **Automated.** Operators pull desired state from Git and apply it.
4. **Self-healing.** If someone manually changes the cluster, the operator reverts it.

### ArgoCD vs Flux

| | ArgoCD | Flux |
|---|---|---|
| **UI** | Rich web UI with app visualization | CLI-driven, minimal UI |
| **Multi-tenancy** | Fine-grained RBAC, multi-cluster | More basic RBAC |
| **Architecture** | Centralized management plane | Decentralized, per-cluster |
| **Progressive delivery** | Argo Rollouts (companion tool) | Flagger integration |
| **Best for** | Teams wanting visual management | Teams wanting lightweight, CLI-first GitOps |
| **CNCF status** | Graduated | Graduated |

**Common pattern:** ArgoCD for application delivery, Flux for cluster bootstrapping. Many orgs use both.

### GitOps Best Practices

- **Separate app code from manifests.** App repo and GitOps repo are different.
- **Use overlays for environments.** Kustomize overlays or Helm values per env (dev/staging/prod).
- **Pin versions explicitly.** No `latest` tags. Exact image digests.
- **Enable self-heal.** Auto-revert manual drift.
- **Enable prune.** Auto-remove resources deleted from Git.
- **Never commit plain secrets.** Use Sealed Secrets, External Secrets Operator, or Vault.

Sources: [DevToolbox: ArgoCD Guide 2026](https://devtoolbox.dedyn.io/blog/argocd-complete-guide), [Northflank: Flux vs Argo CD](https://northflank.com/blog/flux-vs-argo-cd)

---

## 7. Platform Engineering & Internal Developer Platforms

### The Shift

Traditional DevOps: "Everyone is responsible for everything." At scale, this becomes "nobody is responsible for anything."

Platform Engineering: Platform teams build **self-service platforms** that encode best practices. Developers consume them without deep infrastructure expertise.

### The 5 Shifts (2026)

1. **Culture → Product.** Infrastructure is a product with users (developers), SLAs, and roadmaps.
2. **Manual coordination → Self-service.** IDPs provide golden paths — opinionated, pre-configured workflows.
3. **Implicit ownership → Explicit accountability.** Platform teams are "engineers for engineers."
4. **Reactive support → Intentional enablement.** Build reusable capabilities, not one-off fixes.
5. **DORA metrics → Developer experience metrics.** Track onboarding time, time-to-first-deploy, platform adoption rates.

### IDP Tools

| Tool | Type | Market Position |
|---|---|---|
| **Backstage** (Spotify) | Developer portal (catalog, docs, templates) | 89% market share among IDP adopters. 270+ public adopters. Hard to configure/maintain. |
| **Port** | No-code developer portal | Software catalog + self-service actions + scorecards. Easier setup than Backstage. |
| **Humanitec** | Platform orchestrator | Backend engine for IDPs. Dynamic config resolution. Complementary to portals. |
| **Kratix** | Platform-as-a-product framework | Kubernetes-native, promise-based abstractions. |

**Practical starting point:** You don't need Backstage on day one. Start with self-service CI/CD templates, standard Dockerfiles, and well-documented runbooks. Formalize into an IDP as patterns emerge.

Sources: [Growin: Platform Engineering 2026](https://www.growin.com/blog/platform-engineering-2026/), [Spacelift: Platform Engineering Tools](https://spacelift.io/blog/platform-engineering-tools), [platformengineering.org: Tools 2026](https://platformengineering.org/blog/platform-engineering-tools-2026)

---

## 8. Security (DevSecOps)

### Supply Chain Security

The 2025 "Shai-Hulud" npm attack and ongoing supply chain threats make this non-negotiable:

| Practice | Tool/Standard | What It Does |
|---|---|---|
| **SBOM** (Software Bill of Materials) | Syft, Trivy, CycloneDX | Lists every component in your software. Compliance requirement in many contexts. |
| **SLSA** (Supply-chain Levels for Software Artifacts) | SLSA framework | Verifies HOW software was built. Attestation of build provenance. |
| **Artifact signing** | Sigstore (cosign) | Cryptographically proves artifact origin. Sign container images, binaries, SBOMs. |
| **Dependency auditing** | `npm audit`, `pnpm audit`, Snyk, Socket | Scan for known vulnerabilities. Run in CI on every build. |
| **Pin dependencies** | lockfiles + version pinning | No `*` or `latest`. Pin exact versions. Verify checksums. |

### Container Security

- **Scan images in CI.** Trivy, Grype, or Snyk container scanning on every build.
- **Minimal base images.** `distroless` or `alpine` — fewer packages = fewer vulnerabilities.
- **No root in containers.** Enforce via Pod Security Standards in Kubernetes.
- **Image signing.** Sign with cosign (Sigstore). Verify signatures at admission (Kyverno or OPA Gatekeeper).
- **Registry security.** Private registries. No pulling arbitrary public images in production.

### Secrets Management

| Tier | Tool | When |
|---|---|---|
| **Dev (local)** | `.env` files (gitignored) | Local development only. Never in production. |
| **Managed SaaS** | Doppler, Infisical | Easiest path. Encrypted storage, access control, audit logs, rotation. |
| **Self-hosted** | HashiCorp Vault | Full control, complex setup. For orgs with strict compliance needs. |
| **Cloud-native** | AWS Secrets Manager, GCP Secret Manager | If you're already on that cloud. Native integration. |

**The .env problem:** Sharing `.env` files over Slack breaks least privilege, has no audit trail, and doesn't scale. Use a secrets manager that injects at runtime.

**Best practice pattern:** Secrets manager (Doppler/Vault) → injects as environment variables at runtime → app reads from `process.env`. No `.env` files in production.

Sources: [Practical DevSecOps: Trends 2026](https://www.practical-devsecops.com/devsecops-trends-2026/), [DevDiligent: Open Source Security 2026](https://devdiligent.com/blog/future-open-source-security-devsecops-sbom-2026/), [Security Boulevard: Env Vars 2026](https://securityboulevard.com/2025/12/are-environment-variables-still-safe-for-secrets-in-2026/)

---

## 9. Observability & Monitoring

### The Stack

| Layer | Open Source | Managed |
|---|---|---|
| **Metrics** | Prometheus + Grafana (or VictoriaMetrics/Mimir) | Datadog, New Relic, Grafana Cloud |
| **Logs** | Loki + Grafana (or OpenSearch) | Datadog, Axiom, Logtail |
| **Traces** | Tempo + Grafana (or Jaeger) | Honeycomb, Datadog, Lightstep |
| **Unified** | SigNoz (OpenTelemetry-native, ClickHouse-backed) | Datadog (expensive), Grafana Cloud |
| **Uptime** | Uptime Kuma | Better Uptime, Pingdom |

### The LGTM Stack (Open Source)

Loki (logs) + Grafana (visualization) + Tempo (traces) + Mimir (metrics) = full observability on open-source tools. All integrate natively with OpenTelemetry.

### SigNoz: The Open-Source Datadog Alternative

- OpenTelemetry-native — no proprietary agents.
- Unified logs, metrics, traces in one UI.
- Built on ClickHouse (fast, efficient storage).
- Self-hosted or cloud.
- Fraction of Datadog's cost.

### Alerting Best Practices

- **Alert on symptoms, not causes.** Alert on "error rate > 1%" not "CPU > 80%."
- **Runbooks for every alert.** If an alert fires, the responder should know exactly what to check and do.
- **Tiered severity.** Critical (page immediately), Warning (investigate within hours), Info (review next business day).
- **Avoid alert fatigue.** Fewer, meaningful alerts > many noisy ones. If an alert is ignored >50% of the time, delete or fix it.
- **SLO-based alerting.** Define SLOs (99.9% availability, p99 < 200ms). Alert when error budget is burning too fast.

Sources: [Dash0: Infrastructure Monitoring Tools 2026](https://www.dash0.com/comparisons/infrastructure-monitoring-tools), [SigNoz: Datadog Alternatives](https://signoz.io/comparisons/open-source-datadog-alternatives/), [CloudChipr: Observability Tools 2026](https://cloudchipr.com/blog/best-cloud-observability-tools-2026)

---

## 10. Cloud Deployment Platforms

### The Spectrum (Increasing Control, Increasing Complexity)

| Platform | Model | Best For | Trade-off |
|---|---|---|---|
| **Vercel / Netlify** | Managed serverless | Frontend + serverless functions | Least control, least ops |
| **Cloudflare Workers** | Edge functions (V8 Isolates) | Edge compute, lowest latency | Strict limits (128MB, 30s CPU) |
| **Railway** | PaaS (git-deploy) | Quick deploys, small projects | No BYOC, sleep mode on free tier |
| **Render** | PaaS (managed containers) | Straightforward container hosting | Flat per-user pricing |
| **Fly.io** | Managed containers (global) | Global distribution, Postgres | Pricing can be opaque at scale |
| **Coolify** | Self-hosted PaaS | Full control, Docker-native, BYOC | You manage the platform itself |
| **Google Cloud Run** | Managed serverless containers | Containers + auto-scaling | GCP lock-in |
| **AWS Fargate** | Managed serverless containers | Containers on AWS without K8s management | AWS ecosystem |
| **Kubernetes (EKS/GKE/AKS)** | Full orchestration | Multi-team, multi-service, complex networking | Maximum ops overhead |

### The 2026 Heuristic

1. **Solo/small team, web app?** → Vercel (frontend) + Railway/Render (backend). Minimal ops.
2. **Need global edge?** → Cloudflare Workers (functions) or Fly.io (containers).
3. **Want full control, no vendor lock-in?** → Coolify on a VPS. Self-hosted PaaS.
4. **Growing team, multiple services?** → Cloud Run / Fargate. Serverless containers.
5. **Large org, complex requirements?** → Kubernetes (EKS/GKE). Accept the ops cost.

### Coolify: The Self-Hosted Alternative

Open-source, self-hosted PaaS on your own VPS:
- Docker-native. Full control over infra.
- No credit caps, no forced upgrades, no surprise shutdowns.
- Supports multiple servers and cloud providers.
- Good for cost-conscious teams who want PaaS DX without PaaS pricing.

Sources: [Northflank: Railway Alternatives 2026](https://northflank.com/blog/railway-alternatives), [Northflank: Railway vs Render](https://northflank.com/blog/railway-vs-render), [Medium: Railway vs Fly.io vs Render](https://medium.com/ai-disruption/railway-vs-fly-io-vs-render-which-cloud-gives-you-the-best-roi-2e3305399e5b)

---

## 11. FinOps & Cost Management

### The Problem

30-40% of cloud spend is wasted on idle resources, over-provisioned infrastructure, and zombie assets. Engineering teams often lack visibility into what their code costs.

### Key Practices

| Practice | Impact |
|---|---|
| **Tag everything** | Resources tagged by team, service, environment. No untagged resources in production. |
| **Rightsizing** | Match instance sizes to actual usage. Most services are over-provisioned by 2-4x. |
| **Spot/preemptible instances** | For fault-tolerant workloads (batch, CI runners). 60-90% cost savings. |
| **Reserved instances / Savings Plans** | For steady-state workloads. 30-60% savings vs on-demand. |
| **Auto-scaling** | Scale to zero for dev/staging environments outside business hours. |
| **Zombie resource cleanup** | Audit for unused EBS volumes, old snapshots, idle load balancers. Automate detection. |
| **Cost per deployment** | Track infrastructure cost per deploy, per feature, per team. Make cost visible to developers. |

### Tools

- **AWS Cost Explorer / GCP Billing** — Built-in, basic visibility.
- **Vantage** — Developer-friendly cost visibility. Cost per service/team.
- **CloudZero** — Cost per deployment, per feature. Engineering-focused.
- **Infracost** — IaC cost estimation in CI. "This Terraform change will cost $X/month."

Sources: [SquareOps: AWS Cost Optimization 2026](https://squareops.com/blog/aws-cost-optimization-complete-2026-guide/), [CloudChipr: FinOps Tools 2026](https://cloudchipr.com/blog/best-finops-tools-for-cloud-cost-management)

---

## 12. Reproducible Environments

### Nix / devenv

Nix is gaining traction for reproducible developer environments and builds:
- **Declarative.** Define all dependencies in a single file. Build is reproducible across machines.
- **Isolated.** Packages don't interfere with each other. No "works on my machine."
- **Rollback.** Atomic upgrades with instant rollback to previous generations.
- **devenv** — Fast, declarative dev environments using Nix. Less steep learning curve than raw Nix.

**When to consider:** Teams struggling with "works on my machine," complex multi-language dependency chains, or CI reproducibility issues.

**When to skip:** Nix has a steep learning curve. If Docker + devcontainers solve your reproducibility needs, that's simpler.

### Dev Containers

VS Code / Codespaces dev containers remain the simpler path to reproducible environments:
- Define `devcontainer.json` with base image, extensions, settings.
- Same environment locally and in CI.
- Less powerful than Nix but lower learning curve.

Sources: [NixOS](https://nixos.org/), [devenv](https://devenv.sh/)

---

## 13. Incident Response & Reliability

### SRE Practices

| Practice | What |
|---|---|
| **SLOs / Error Budgets** | Define acceptable reliability (99.9%). Alert when error budget burns too fast. Remaining budget = room for deploys. |
| **Runbooks** | Documented procedure for every alert. What to check, what to do, who to escalate to. |
| **Blameless Postmortems** | Focus on systems, not people. What failed, why, and what to change. Publish internally. |
| **Incident Response Lifecycle** | Prepare → Detect → Contain → Eradicate → Recover → Learn |
| **On-call rotation** | Sustainable on-call with clear escalation paths. Compensate on-call engineers. |

### Postmortem Template

```markdown
## Incident Summary
- **Date:**
- **Duration:**
- **Severity:**
- **Impact:** (users affected, revenue lost, SLO impact)

## Timeline
(Chronological sequence of events)

## Root Cause
(What actually broke and why)

## What Went Well
(Detection, response, communication)

## What Went Wrong
(Gaps in detection, response, or communication)

## Action Items
- [ ] (Corrective action with owner and deadline)
- [ ] (Preventive action with owner and deadline)
```

### Tools

- **PagerDuty / Opsgenie** — On-call management, escalation.
- **incident.io** — AI-powered incident management. Slack-native. 17-70% MTTR reduction.
- **Rootly** — Incident management and postmortem automation.
- **Statuspage** — Public status communication.

Sources: [Google SRE Book](https://sre.google/sre-book/emergency-response/), [Rootly: SRE Best Practices](https://rootly.com/sre/2025-sre-incident-management-best-practices-checklist), [incident.io: AI-powered platforms](https://incident.io/blog/5-best-ai-powered-incident-management-platforms-2026)

---

## Open Questions

- **Platform engineering maturity** — Most teams aren't ready for Backstage. What's the minimal viable IDP for a team of 5-20?
- **OpenTofu adoption velocity** — Will it capture enough Terraform users to sustain a healthy ecosystem, or does Terraform's BSL not bother most teams enough to switch?
- **SST v3 longevity** — Is SST the right long-term bet for serverless IaC, or is it too AWS-centric?
- **Nix mainstream adoption** — The DX is improving (devenv, Flakes) but the learning curve is still steep. Will it break through?
- **AI in DevOps** — How far can AIOps go before humans lose context on what their systems actually do?

## Extracted Principles

1. **GitOps for deployment.** Git is the single source of truth. ArgoCD or Flux for Kubernetes. 64% adoption, 81% report higher reliability.
2. **Platform engineering over DevOps teams.** Build self-service IDPs with golden paths. Measure developer experience, not just DORA metrics.
3. **IaC everything.** Terraform/OpenTofu for multi-cloud, Pulumi for TypeScript teams, SST for serverless. Never manual console changes.
4. **Supply chain security is mandatory.** SBOM + SLSA + Sigstore + dependency auditing in CI. Pin dependencies, sign artifacts.
5. **Secrets manager, not .env files.** Doppler or Infisical for SaaS. Vault for self-hosted. Inject at runtime, not build time.
6. **Progressive delivery.** Canary + metric gates for critical services. Feature flags to decouple deploy from release.
7. **Docker for dev, Podman for prod.** Both OCI-compliant. Podman is rootless, daemonless, more secure by default.
8. **Right-size your orchestration.** Railway/Render → Cloud Run/Fargate → Kubernetes. Only add complexity when scale demands it.
9. **Alert on symptoms, not causes.** SLO-based alerting. Runbooks for every alert. Blameless postmortems.
10. **FinOps from day one.** Tag resources, rightsize instances, shut down dev/staging off-hours, track cost per deployment.

→ Principles filed to `principles/devops-infrastructure.md`
