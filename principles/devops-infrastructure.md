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
- **What:** SBOM generation (Syft/Trivy), SLSA build attestation, artifact signing (Sigstore/cosign), dependency auditing (`npm audit`/Snyk) in CI. Pin dependencies to exact versions. Scan container images.
- **Why:** The "Shai-Hulud" npm attack (2025) compromised thousands of packages. Supply chain attacks are the #1 growing threat vector. SBOM is now a compliance requirement in many contexts.
- **When:** Every production application. Integrate into CI from day one.
- **Source:** [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md)

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
- **What:** Tag all resources by team/service/environment. Rightsize instances. Spot instances for fault-tolerant workloads. Shut down dev/staging off-hours. Track cost per deployment with tools like Infracost, Vantage, or CloudZero.
- **Why:** 30-40% of cloud spend is wasted. Without cost visibility, teams have no incentive to optimize. Infracost in CI shows "this Terraform change costs $X/month" before merge.
- **When:** Any cloud deployment. The longer you wait, the harder it is to retrofit tagging and visibility.
- **Source:** [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md)

## Revision History
- 2026-02-13: Initial extraction from [research/2026-02-13-devops-infrastructure-practices.md](../research/2026-02-13-devops-infrastructure-practices.md).
