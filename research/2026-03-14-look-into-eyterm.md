---
date: 2026-03-14
topic: Look into eyterm
status: complete
tags: []
---

# Look into eyterm

## Context
This session investigated the request "Look into eyterm". The exact spelling `eyterm` does not appear to map cleanly to a distinct, authoritative product. The credible source trail instead converges on `ETERM` or `eTerm`, the long-running China TravelSky terminal ecosystem used by airline and travel-agent operators, plus related products such as `MyEterm`, `腾云APP`, `航信助手`, and the newer replacement platform `共翔天易`. This write-up therefore treats "eyterm" as a likely reference to the ETERM ecosystem, and explicitly notes where conclusions are inference rather than direct vendor language.

## Findings

### 1. The most important current fact is that legacy ETERM has already been retired
The strongest current signal is not "how to adopt ETERM", but "how to understand the post-ETERM world". Multiple authoritative reports describe a formal cutover on **2025-12-25**. China TravelSky states that the long-running black-screen `ETERM` ticketing terminal completed its historical mission and was replaced by the new-generation `共翔天易` system after supporting China's civil aviation distribution workflows for nearly 30 years. The public reporting also ties the rollout to large operational scale, including more than 2,600 agents, 39 airlines, and roughly 40,000 terminal endpoints. ([SASAC, 2026-01-09](https://wap.sasac.gov.cn/n2588025/n2588124/c35276150/content.html); [The Paper / China TravelSky post, 2025-12-26](https://m.thepaper.cn/newsDetail_forward_32261737))

Practical implication: as of **2026-03-14**, researching ETERM should mostly be framed as legacy-system understanding, migration support, operational continuity, and replacement planning. For any new implementation, automation effort, training program, or integration idea, the default assumption should be that the target surface is `共翔天易` or another current TravelSky service layer, not black-screen ETERM itself. That recommendation is an inference from the retirement notices and the current support surfaces described below. ([SASAC, 2026-01-09](https://wap.sasac.gov.cn/n2588025/n2588124/c35276150/content.html); [China TravelSky Service Online](https://cs.travelsky.com.cn/cs/index))

### 2. ETERM mattered because it was an expert, high-throughput operational surface
The ETERM ecosystem was not just "an old terminal". It was an operator-facing production system deeply embedded in reservation, ticketing, and service workflows. Evidence from TravelSky's own legacy mobile products shows that the company supported command-driven usage patterns across desktop and mobile for years. The official `腾云APP` described itself as an official eTerm mobile front end, supporting black-screen command access, real-time message sending and receiving, ticketing, and related business operations. That is a strong indicator that ETERM's value came from expert efficiency, command density, and continuity of operator habits, not from a modern user experience. ([腾云APP, App Store](https://apps.apple.com/us/app/%E8%85%BE%E4%BA%91app/id1011667510))

This also explains why migration away from ETERM is non-trivial. Replacing a legacy terminal in a regulated industry does not just swap one UI for another. It disrupts operator muscle memory, work-number and identity processes, training materials, support playbooks, and any scripts or informal macros built around the old workflow. The retirement of ETERM should therefore be interpreted as a major operational modernization event, not a cosmetic client refresh. That conclusion is inferred from the scale of the retirement, the existence of dedicated support portals, and the breadth of mobile and training tooling around the ecosystem. ([The Paper / China TravelSky post, 2025-12-26](https://m.thepaper.cn/newsDetail_forward_32261737); [China TravelSky Service Online](https://cs.travelsky.com.cn/cs/index); [航信助手, App Store](https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036))

### 3. The current support stack shows how TravelSky is managing the transition
The official support surfaces are useful because they reveal what TravelSky thinks operators actually need during and after the migration. `中国航信服务在线` exposes help-desk access, notice management, training, business-system entry points, and a login flow tied to organization and account management. That implies the operational center of gravity has shifted from a standalone terminal mentality toward a service platform mentality. Support, training, identity, and system access are being gathered under a common online service layer instead of being treated as separate back-office concerns. ([China TravelSky Service Online](https://cs.travelsky.com.cn/cs/index); [China TravelSky login portal](https://cs.travelsky.com.cn/cas/login))

The official `航信助手` iOS app reinforces the same pattern. Its version history mentions work-number binding, smart customer service, online classroom content, best-practice content, a product center with a `共翔天易` entry point, and ETERM-B fault-reporting and quick templates. It also added support for "国家网络身份认证" and references to organization and identity workflows. This is exactly what a serious terminal-to-platform migration looks like in practice: not only a new front end, but also a support plane around identity, learning, notices, troubleshooting, and product entry. ([航信助手, App Store](https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036))

One detail in the `航信助手` release notes is especially important. The app history shows a phased shift away from "机票版" entry points in 2025, with notes about stopping that entry option in December and earlier machine-version related function offlining in August. That release cadence suggests TravelSky did not handle the ETERM retirement as a one-day event. It managed the transition as a staged shutdown with support tooling updated ahead of or alongside the final December 25 cutover. This is useful evidence for migration planning even outside aviation. ([航信助手, App Store](https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036))

### 4. Third-party and legacy-adjacent tools still exist, but they now look like compatibility layers
The continued presence of `MyEterm` on the App Store is an important ecosystem signal. It presents itself as a mobile tool that can replace a phone-based black-screen workflow when paired with an XP-era linked computer and related setup. That positioning suggests there is still residual demand for ETERM-like access patterns, but it also underlines the legacy nature of the stack. A modern greenfield operator platform would not normally describe itself in terms of XP-era linkage or black-screen replacement. ([MyEterm, App Store](https://apps.apple.com/us/app/myeterm/id651362066))

The decision implication is straightforward. If the goal is production-grade operations in 2026, official TravelSky surfaces should be treated as the default path. Third-party or compatibility-oriented tools may still be useful for transitional access, remote convenience, or legacy holdouts, but they carry obvious support, security, and compliance questions. The available public evidence does not show `MyEterm` as an official TravelSky product, while `腾云APP`, `航信助手`, and `中国航信服务在线` are clearly tied to China TravelSky. That makes official-first a much safer recommendation for any serious deployment. This recommendation is inference from source provenance and product descriptions, not from an explicit vendor policy statement. ([MyEterm, App Store](https://apps.apple.com/us/app/myeterm/id651362066); [腾云APP, App Store](https://apps.apple.com/us/app/%E8%85%BE%E4%BA%91app/id1011667510); [航信助手, App Store](https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036))

### 5. Best practices for anyone who still depends on ETERM-era workflows
For existing agencies, support teams, or researchers trying to understand the surviving ETERM footprint, the best practice is to treat the problem as **legacy workflow migration**, not as app discovery.

Recommended approach:

- Inventory operator tasks, not just software names. List booking, ticketing, refund, BSP settlement, queue handling, message handling, and exception flows separately.
- Identify which steps still require ETERM-era command knowledge versus which steps already have `共翔天易` or service-portal equivalents.
- Move identity and support dependencies first. If work-number binding, service login, notices, and training are not stable, front-end replacement will fail in practice.
- Prefer official support channels and product entry points before evaluating third-party wrappers.
- Run cutover drills on real edge cases, especially refunds, changes, queue operations, and outage reporting.
- Preserve a short-lived compatibility path only where retraining risk is genuinely higher than temporary dual-stack cost.

The public sources strongly support this pattern even if they do not state it as a formal methodology. TravelSky's visible investments are in service portals, classroom training, work-number management, product-center entry points, and staged deprecation. Those are migration signals, not legacy-expansion signals. ([China TravelSky Service Online](https://cs.travelsky.com.cn/cs/index); [航信助手, App Store](https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036); [SASAC, 2026-01-09](https://wap.sasac.gov.cn/n2588025/n2588124/c35276150/content.html))

### 6. A practical decision framework
If you need to decide what to do with "eyterm" or ETERM-related work in 2026, use this framework:

**Case A: New project, new agency setup, or fresh automation effort**
Default to current official surfaces. Do not build net-new automation or training around retired black-screen ETERM unless a concrete regulatory or contractual dependency forces it. ([SASAC, 2026-01-09](https://wap.sasac.gov.cn/n2588025/n2588124/c35276150/content.html))

**Case B: Existing operator team with entrenched habits**
Treat migration risk as primarily human and operational. Budget for training, account binding, notices, and support escalation, not just software access. ([China TravelSky Service Online](https://cs.travelsky.com.cn/cs/index); [航信助手, App Store](https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036))

**Case C: Need mobile convenience for legacy workflows**
Use official mobile surfaces first. Be cautious with third-party black-screen wrappers, especially where they appear to depend on older desktop linkage patterns. ([腾云APP, App Store](https://apps.apple.com/us/app/%E8%85%BE%E4%BA%91app/id1011667510); [MyEterm, App Store](https://apps.apple.com/us/app/myeterm/id651362066))

**Case D: Researching industry trend, not operating the system**
Study ETERM as a case of legacy terminal retirement in a high-volume, high-regulation environment. The interesting question is how the migration was staged and supported, not how to learn a retired command set. ([The Paper / China TravelSky post, 2025-12-26](https://m.thepaper.cn/newsDetail_forward_32261737); [航信助手, App Store](https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036))

### 7. Trade-offs
The ETERM story makes several trade-offs visible:

- **Expert speed vs onboarding cost:** command-heavy terminals are fast for trained operators, but expensive to learn and difficult to broaden safely. ([腾云APP, App Store](https://apps.apple.com/us/app/%E8%85%BE%E4%BA%91app/id1011667510))
- **Continuity vs modernization:** keeping legacy-compatible clients reduces immediate retraining pain, but prolongs platform complexity and can preserve brittle dependencies. ([MyEterm, App Store](https://apps.apple.com/us/app/myeterm/id651362066); [航信助手, App Store](https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036))
- **Official support vs unofficial flexibility:** official tools are more likely to fit identity, support, and policy requirements, while unofficial tools may fill niche gaps faster but with murkier guarantees. ([China TravelSky Service Online](https://cs.travelsky.com.cn/cs/index); [MyEterm, App Store](https://apps.apple.com/us/app/myeterm/id651362066))
- **One-time cutover vs staged retirement:** TravelSky's public tooling signals favor staged retirement, which usually costs more in the short term but reduces operational shock. ([航信助手, App Store](https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036); [SASAC, 2026-01-09](https://wap.sasac.gov.cn/n2588025/n2588124/c35276150/content.html))

### 8. Concrete example, how to audit an ETERM-dependent team
The following template is not vendor documentation. It is a practical inventory structure inferred from the public source set and is useful if you need to map a team off ETERM-era workflows:

```yaml
migration_inventory:
  task: "Domestic booking and ticketing"
  legacy_surface: "ETERM black-screen terminal"
  identity_dependencies:
    - "work number"
    - "service portal login"
  replacement_surface: "共翔天易"
  enablement_dependencies:
    - "航信助手 access"
    - "training enrollment"
    - "help desk escalation path"
  cutover_checks:
    - "refund and reissue flow tested"
    - "queue and message handling verified"
    - "operator no longer depends on unofficial wrapper"
```

This template encodes the main lesson from the source set: migration readiness is not just "can the operator open the new app". It is "can the operator complete the real task, with the right identity, the right support path, and the right exception handling". ([China TravelSky Service Online](https://cs.travelsky.com.cn/cs/index); [航信助手, App Store](https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036))

### 9. Emerging trends
Three trends stand out.

First, TravelSky appears to be moving from terminal-centric operations toward platform-centric operations. The visible surfaces are not only booking tools, but also service portals, mobile assistants, identity workflows, and classroom content. ([China TravelSky Service Online](https://cs.travelsky.com.cn/cs/index); [航信助手, App Store](https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036))

Second, retirement of black-screen infrastructure is being paired with localization and next-generation system messaging. Public reporting around the `共翔天易` launch explicitly frames it as a new-generation, self-controlled core product, which is consistent with broader Chinese enterprise-software trends around domestic substitution and stack control. ([SASAC, 2026-01-09](https://wap.sasac.gov.cn/n2588025/n2588124/c35276150/content.html); [The Paper / China TravelSky post, 2025-12-26](https://m.thepaper.cn/newsDetail_forward_32261737))

Third, residual compatibility demand does not disappear the day a legacy system is retired. The existence of tools like `MyEterm`, alongside official assistant and service products, suggests the realistic end state is not immediate uniformity but managed coexistence followed by attrition. That is a common modernization pattern in operational software. ([MyEterm, App Store](https://apps.apple.com/us/app/myeterm/id651362066); [航信助手, App Store](https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036))

### 10. Source notes
Primary sources used for this session:

- SASAC repost on China TravelSky's ETERM retirement and `共翔天易` launch, dated 2026-01-09: <https://wap.sasac.gov.cn/n2588025/n2588124/c35276150/content.html>
- China TravelSky post on The Paper, dated 2025-12-26: <https://m.thepaper.cn/newsDetail_forward_32261737>
- China TravelSky Service Online portal: <https://cs.travelsky.com.cn/cs/index>
- China TravelSky login portal: <https://cs.travelsky.com.cn/cas/login>
- `航信助手` App Store page and release history: <https://apps.apple.com/us/app/%E8%88%AA%E4%BF%A1%E5%8A%A9%E6%89%8B/id6469027036>
- Official `腾云APP` App Store page: <https://apps.apple.com/us/app/%E8%85%BE%E4%BA%91app/id1011667510>
- `MyEterm` App Store page: <https://apps.apple.com/us/app/myeterm/id651362066>
- Public training-detail page from China TravelSky Service Online, showing current training infrastructure: <https://cs.travelsky.com.cn/cs/train/getTrainDetail?id=2908>

## Open Questions
- Public documentation for `共翔天易` appears limited. I did not find a public feature-by-feature replacement map from ETERM commands to `共翔天易` workflows.
- It is unclear which parts of the ETERM ecosystem remain operational only as compatibility shims, and which have fully shut down.
- Public sources do not clearly document whether official partner APIs exist for workflows that older operators once handled directly in ETERM.
- The exact ongoing support status of unofficial tools such as `MyEterm` after the December 25, 2025 cutover is unclear.

## Extracted Principles
- Updated [principles/migration-legacy-modernization.md](../principles/migration-legacy-modernization.md) with migration lessons about preserving expert workflows during front-end replacement and shipping the support plane with the new front end.
