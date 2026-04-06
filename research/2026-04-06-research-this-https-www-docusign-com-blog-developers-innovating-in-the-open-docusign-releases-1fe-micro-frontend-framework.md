---
date: 2026-04-06
topic: research this: https://www.docusign.com/blog/developers/innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework
status: complete
tags: []
---

# research this: https://www.docusign.com/blog/developers/innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework

## Context
This session investigated the article described as "research this: https://www.docusign.com/blog/developers/innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework". The goal was not only to summarize the Docusign announcement, but to determine what 1FE actually is, how it works today, how it compares to other micro-frontend approaches, and when it is or is not a good architectural choice. There was no matching principle in the local principles DB. The automated prior-research lookup failed with a `malformed JSON` error in `automation/query-db.ts`, so this session proceeded from fresh source research across the Docusign post, current 1FE docs, the public GitHub repo and npm packages, single-spa docs, Module Federation docs, MDN, and Martin Fowler's canonical micro-frontends article.

## Findings

### 1. What Docusign actually released
Docusign did not just open-source a loader or a shell. The announcement describes 1FE as the result of a broader internal modernization program that replaced a fragmented estate of ASPX, AngularJS, divergent build tools, duplicated libraries, and app-specific CI/CD with a shared platform for frontend development, deployment, and execution ([Docusign blog](https://www.docusign.com/blog/developers/innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework)).

The most important detail in the post is that the business case was operational, not ideological. Docusign's stated problems were duplicated platform work, poor developer transferability between apps, inconsistent quality, and slow coordinated fixes across many codebases. Their solution principles were:

- a common shared base framework
- project independence for roll-forward and rollback
- CI/CD best practices by default
- quality gates built into the toolchain
- "easy to check in good code, hard to check in bad code"

That framing matters. 1FE is best understood as a platform-team answer to organizational frontend sprawl, not as a universal replacement for ordinary SPA or meta-framework stacks. The strongest evidence in the post is outcome-oriented: Docusign says one team reduced minimum build-to-production time from six days to less than two hours, increased deployment frequency by 3x, reduced rollback time from more than an hour to less than three minutes, and improved page-load reliability from 99.96% to 99.993% ([Docusign blog](https://www.docusign.com/blog/developers/innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework)). Those are platform and release-system gains more than UI composition gains.

### 2. Current public state of 1FE, as of 2026-04-06
The project is current, public, and documented. The [GitHub repository](https://github.com/docusign/1fe) exposes a monorepo with core packages for `@1fe/server`, `@1fe/shell`, `@1fe/cli`, and `@1fe/create-1fe-app`, plus docs and demo references. When checked on 2026-04-06, the repo page showed 215 commits, 29 releases, and a latest listed GitHub release for `@1fe/shell@0.1.6` on 2025-10-28 ([GitHub repo](https://github.com/docusign/1fe)).

The npm packages also show recent activity. The [`@1fe/server` package page](https://www.npmjs.com/package/%401fe/server) showed version `0.1.5`, "published a day ago", and 413 weekly downloads when queried during this session. That package documents dynamic configuration polling, widget loading, CSP management, and health monitoring ([npm package](https://www.npmjs.com/package/%401fe/server)). The docs site at [1fe.com](https://1fe.com/start-here/) includes a start guide, proof-of-concept tutorial, productionization guides, platform utility references, and a live demo path, which is more substantial than a typical marketing-only open-source launch ([1FE docs](https://1fe.com/start-here/)).

Inference: 1FE looks actively maintained but still early in external adoption. The public footprint is real and current, but small compared with established ecosystems like single-spa or Module Federation. That does not make it weak, but it does raise the usual early-ecosystem questions around community size, third-party integrations, and operational examples outside the originating company.

### 3. How 1FE works in technical terms
The clearest short definition is from the docs: 1FE standardizes "development, deployment and execution" of frontend experiences through a shared platform layer ([What is 1fe?](https://1fe.com/learning/what-is-1fe/)). Concretely, the architecture has three major parts:

- `@1fe/server`, an Express-based server that serves the shell and polls runtime configuration for widget versions, library versions, and dynamic config
- `@1fe/shell`, a SPA shell that owns layout, routing, auth surfaces, and platform utilities
- widget repositories plus shared config/tooling packages, so product teams ship independently while still inheriting common standards

The runtime control plane is the interesting part. 1FE docs describe live configuration files for widget versions, library versions, and dynamic settings that are fetched at runtime from a CDN or config service. The proof-of-concept deployment guide shows `widget-versions.json`, `lib-versions.json`, and `live.json` URLs being wired into the server config, with a `refreshMs` poll interval of 30 seconds, plus CDN-hosted shared libraries and shell bundles ([Deploy POC guide](https://1fe.com/tutorials/setup-and-deploy-1fe-poc/deploy-poc/), [@1fe/server npm](https://www.npmjs.com/package/%401fe/server)).

An adapted 1FE-style server setup looks like this:

```ts
import oneFEServer from "@1fe/server";

const app = oneFEServer({
  port: 3000,
  configManagement: {
    widgetVersions: {
      url: "https://cdn.example.com/configs/widget-versions.json",
    },
    libraryVersions: {
      url: "https://cdn.example.com/configs/lib-versions.json",
    },
    dynamicConfigs: {
      url: "https://cdn.example.com/configs/live.json",
    },
    refreshMs: 30_000,
  },
  cspConfigs: {
    "script-src": ["'self'", "https://cdn.example.com"],
    "style-src": ["'self'", "'unsafe-inline'"],
  },
});
```

This code is adapted from the package docs and deployment guide, which both show the same core idea: runtime-managed widget and library URLs, plus CSP rules for the CDN surface ([npm package](https://www.npmjs.com/package/%401fe/server), [Deploy POC guide](https://1fe.com/tutorials/setup-and-deploy-1fe-poc/deploy-poc/)).

The docs also explicitly say 1FE's "dynamic module federation" is powered by SystemJS and import maps, not by webpack-native Module Federation. That is important because it makes 1FE fundamentally a standards-oriented, runtime-composition platform. Import maps are no longer speculative browser technology. MDN marks `<script type="importmap">` as baseline and widely available across browsers since March 2023 ([MDN importmap](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap)).

A minimal runtime-composition sketch for that model is:

```html
<script type="importmap">
{
  "imports": {
    "@acme/navbar": "https://cdn.example.com/widgets/navbar/v42/index.js",
    "react": "https://cdn.example.com/libs/react/19.2.0/index.js"
  }
}
</script>
```

That pattern is aligned with the browser import-map model described by MDN and with single-spa's recommended setup for in-browser modules ([MDN JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [single-spa recommended setup](https://single-spa.js.org/docs/recommended-setup/)).

### 4. 1FE sits on the runtime-composition side of the micro-frontend design space
The strongest architectural insight from this research is that 1FE is not "just another micro-frontend framework". It is a specific answer to a long-running split in micro-frontend architecture:

- build-time coupling, where the shell knows remote packages or modules at compile time
- runtime composition, where the shell or router loads versioned artifacts dynamically

Martin Fowler's micro-frontends article strongly recommends avoiding build-time package integration when independent deployability is the goal, because recompiling and rereleasing the whole composed app for each change reintroduces the coupling micro-frontends were supposed to remove ([Fowler](https://martinfowler.com/articles/micro-frontends.html)). Fowler's preferred default is runtime integration via JavaScript, with explicit entry points and lightweight contracts. single-spa reaches a similar place through import maps and SystemJS, and explicitly recommends import maps for shared dependencies while encouraging developers to run one microfrontend locally against deployed versions of the rest ([single-spa FAQ](https://single-spa.js.org/docs/faq/), [single-spa recommended setup](https://single-spa.js.org/docs/recommended-setup/)).

1FE clearly aligns with that lineage. Its docs explicitly criticize webpack-tied solutions as too coupled to a bundler and too constrained by compile-time knowledge of widgets ([Why 1fe?](https://1fe.com/learning/why-1fe/)). That comparison is directionally fair, but it overstates the gap slightly in 2026. The current [Module Federation documentation](https://module-federation.io/guide/start/index.html) shows that Module Federation 2.0 now includes a runtime, manifest, runtime plugins, dynamic type hints, and Chrome DevTools support. So the modern comparison is not "1FE is dynamic, Module Federation is static." It is closer to this:

- 1FE / import-map model: better when you want tool-agnostic runtime composition, a platform control plane, and the freedom to evolve across bundlers
- Module Federation 2.0: better when you are already standardized on webpack or rspack, want bundler-native sharing, and value the increasingly rich runtime and debugging ecosystem

single-spa's own docs now say import maps and Module Federation can complement each other, but recommend choosing one strategy consistently for shared third-party dependencies, with a preference toward import maps ([single-spa recommended setup](https://single-spa.js.org/docs/recommended-setup/)). That makes 1FE feel less like an isolated invention and more like a platformized packaging of the import-map/runtime-composition school.

### 5. Best practices that hold up across 1FE, single-spa, and Fowler

#### Adopt micro-frontends for organizational scaling, not because the codebase is "big"
single-spa explicitly recommends staying monolithic for small projects and only moving once organizational or feature scaling becomes hard ([single-spa FAQ](https://single-spa.js.org/docs/faq/)). Fowler makes the same point more indirectly by emphasizing autonomous teams and independent deployability as the central benefit, with operational complexity as the cost ([Fowler](https://martinfowler.com/articles/micro-frontends.html)). Docusign's own story is almost entirely about organizational fragmentation. Recommendation: use micro-frontends only when multi-team delivery, gradual migration, or product-suite composition is the actual bottleneck.

#### Split by business capability or user-facing surface, not technical layer
Fowler recommends organizing micro-frontends around what end users see and what a single team can own end-to-end, not around styling, forms, or validation as horizontal concerns ([Fowler](https://martinfowler.com/articles/micro-frontends.html)). 1FE's docs and blog echo this with "widgets" and independent team ownership ([What is 1fe?](https://1fe.com/learning/what-is-1fe/), [Docusign blog](https://www.docusign.com/blog/developers/innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework)). Recommendation: start by decomposing at route or experience boundaries, not by component categories.

#### Keep the shell thin and platform-owned
1FE works because the shell/server layer centralizes auth, layout, routing, logging, i18n, analytics, dependency loading, and quality controls, while widgets keep product logic local ([What is 1fe?](https://1fe.com/learning/what-is-1fe/), [GitHub repo](https://github.com/docusign/1fe)). That is consistent with single-spa's advice not to turn the root application into a giant UI framework parent that couples everything together ([single-spa FAQ](https://single-spa.js.org/docs/faq/)). Recommendation: the shell should own platform concerns and composition, not feature logic.

#### Treat routes, public imports, and events as contracts. Avoid shared global state
single-spa recommends cross-microfrontend imports, utility modules, custom events, and keeping each app responsible for as much of its own state as possible ([single-spa FAQ](https://single-spa.js.org/docs/faq/), [single-spa recommended setup](https://single-spa.js.org/docs/recommended-setup/)). Fowler recommends very limited cross-application communication, favoring URLs, callbacks, or events over shared stores and warning that shared domain models recreate tight coupling ([Fowler](https://martinfowler.com/articles/micro-frontends.html)). Recommendation: make the URL, public entry modules, and event contracts explicit and testable. Do not default to a shared Redux store for the entire suite.

#### Share only heavyweight, stable dependencies
Fowler describes the central tension clearly: duplicating dependencies increases payload, but externalizing everything creates version lockstep ([Fowler](https://martinfowler.com/articles/micro-frontends.html)). single-spa says large libraries like React are good sharing candidates, while smaller or faster-moving libraries can be duplicated so teams can upgrade independently ([single-spa recommended setup](https://single-spa.js.org/docs/recommended-setup/)). 1FE's docs take the same approach by externalizing common libraries and centralizing library version control ([Deploy POC guide](https://1fe.com/tutorials/setup-and-deploy-1fe-poc/deploy-poc/), [What is 1fe?](https://1fe.com/learning/what-is-1fe/)). Recommendation: share React, design systems, auth helpers, and other high-leverage stable dependencies; duplicate smaller fast-moving ones where autonomy matters more than byte savings.

#### Style isolation is mandatory
Fowler's warning here still stands: CSS is globally cascading, and micro-frontends intensify the blast radius of careless selectors ([Fowler](https://martinfowler.com/articles/micro-frontends.html)). The exact mechanism can vary, such as CSS Modules, strict naming, Shadow DOM, or another scoped strategy. Recommendation: do not permit raw global selectors from independent widgets unless they are namespaced and deliberate.

#### Local development should be single-widget, but validation must be integrated
single-spa recommends running only the microfrontend being developed locally and pointing the rest at deployed versions, often via import-map overrides, because running everything locally is unwieldy and increases drift ([single-spa recommended setup](https://single-spa.js.org/docs/recommended-setup/)). 1FE similarly provides a playground and standalone/local widget workflows, while Fowler warns that development environments that differ too much from production create integration risk ([What is 1fe?](https://1fe.com/learning/what-is-1fe/), [Fowler](https://martinfowler.com/articles/micro-frontends.html)). Recommendation: optimize for one-widget local dev, but back it with preview environments, contract tests, and integrated smoke tests against a production-like shell.

### 6. Trade-offs and risks

#### Operational complexity is the real tax
Fowler is blunt that micro-frontends create more repositories, pipelines, servers, tooling, and governance burden ([Fowler](https://martinfowler.com/articles/micro-frontends.html)). 1FE tries to pay down that tax with templates, shared tooling, shell conventions, and a control plane, but it does not erase the tax. It mostly moves it into a platform team. If you do not have the appetite to own CDN strategy, config management, version manifests, CSP, cross-team contracts, and deployment automation, 1FE will feel like infrastructure theater rather than velocity.

#### Runtime power creates runtime governance work
1FE's live-config model is powerful because widget versions and library versions can change without rebuilding the shell ([Deploy POC guide](https://1fe.com/tutorials/setup-and-deploy-1fe-poc/deploy-poc/)). The downside is that configuration becomes a production control plane. That means config review, provenance, rollback rules, CSP maintenance, environment segmentation, and observability are no longer optional plumbing.

#### Performance is situational, not automatic
Docusign reports improved performance, and 1FE's docs emphasize thin bundles and lazy loading ([Docusign blog](https://www.docusign.com/blog/developers/innovating-in-the-open-docusign-releases-1fe-micro-frontend-framework), [What is 1fe?](https://1fe.com/learning/what-is-1fe/)). Fowler's warning is the right one: duplicated dependencies can be fine or terrible depending on user flows, caching, and asset mix, so measure in production rather than assuming architecture alone wins ([Fowler](https://martinfowler.com/articles/micro-frontends.html)).

#### 1FE has an explicit SPA-shell bias
The docs repeatedly describe 1FE as a single-page application shell ([What is 1fe?](https://1fe.com/learning/what-is-1fe/)). Inference: that makes it a natural fit for authenticated product suites and internal platforms, but potentially a weaker default fit for SEO-heavy marketing surfaces or React Server Components-first architectures where server rendering is the center of gravity. This is not a proof that 1FE cannot support those needs, only that the public docs do not make that story first-class.

#### Ecosystem size is a real evaluation criterion
Module Federation and single-spa have broader community mindshare, more tutorials, and more third-party examples. 1FE's differentiator is the degree of platformization and the operational model Docusign packaged around runtime composition. If you adopt it, you are betting more on a framework philosophy plus a control plane than on a large community ecosystem.

### 7. Decision framework

#### 1FE is a strong fit when
- You have many product teams shipping into one authenticated product suite.
- Your main pain is duplicated platform work, inconsistent tooling, and release coupling.
- You want widgets to deploy independently without rebuilding the shell.
- You want runtime control of widget versions and library versions.
- You are willing to fund a real platform team that owns shell, config, CDN, CI/CD templates, and governance.

#### 1FE is a weak fit when
- You have one team or a small number of tightly coordinated teams.
- Your biggest needs are SEO, server-rendered content, or a meta-framework's app-router features rather than cross-product composition.
- You do not want to own a runtime control plane and its operational overhead.
- Your stack is already deeply standardized on webpack or rspack, and Module Federation 2.0 may solve most of the same problems with less platform surface.

#### Practical recommendation
For a team evaluating 1FE today, the sensible path is:

1. Prove the organizational problem first. Count duplicated utilities, release coordination delays, and cross-team onboarding friction.
2. Run a proof of concept with one shell and one or two widgets using `@1fe/create-1fe-app` and the widget starter kit ([POC setup](https://1fe.com/tutorials/setup-and-deploy-1fe-poc/installation/)).
3. Externalize only stable heavy dependencies first, such as React and design-system primitives.
4. Treat version manifests and live config as production code, with review, provenance, rollback, and observability.
5. Add contract tests for routes, public imports, and widget mount points before onboarding many teams.
6. Compare that result against a thinner alternative: single-spa plus import maps, or Module Federation 2.0 if your bundler standardization already exists.

Bottom line: the most valuable part of 1FE is not that it proves micro-frontends are possible. That has been known for years. The valuable part is that it packages runtime composition, governance, and release control into a coherent platform story that large product suites can actually operate.

## Open Questions
- How strong is 1FE's story for SSR, React Server Components, and SEO-sensitive surfaces? The public docs emphasize SPA runtime composition, not server-first rendering.
- How many non-Docusign organizations are running 1FE in production, and what migration stories or failure reports exist?
- What is the long-term stance on SystemJS versus native import maps as browser support continues to improve?
- How mature are the operational patterns around config provenance, rollback auditing, and runtime observability in multi-team production environments?
- How much of Docusign's reported improvement came from micro-frontends specifically, versus from the surrounding investments in CI/CD templates, linting, shared utilities, and platform governance?

## Extracted Principles
- Added [principles/micro-frontends.md](../principles/micro-frontends.md) covering when micro-frontends are justified, why runtime composition should be preferred when independent deployability is the goal, how to handle shared dependencies, how to keep contracts thin, and why integrated testing is required.
