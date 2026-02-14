# Engineering Sources Principles

## Summary
Guidance on where to find the highest-quality software engineering knowledge, organized by stack layer. Helps future research sessions start from the right sources instead of wading through SEO-optimized filler.

## Principles

### Match the Source to the Layer
- **What:** Different sources dominate different layers. ByteByteGo for system design, web.dev for web platform, Stripe blog for API design, CNCF for cloud-native, NN/g for UX research. No single source covers everything well.
- **Why:** A source that's tier 1 for frontend (Josh Comeau) has nothing on DevOps. A source that's tier 1 for system design (ByteByteGo) barely touches CSS. Using the wrong source wastes time and produces weaker research.
- **When:** Every research session. Consult the topic→source mapping table in the research file before starting.
- **Source:** [research/2026-02-13-engineering-sources-guide.md](../research/2026-02-13-engineering-sources-guide.md)

### Official Docs First
- **What:** Read framework/library documentation before searching for blog posts. React docs, MDN, Hono docs, Prisma docs, OpenTelemetry docs are often more accurate and current than any tutorial.
- **Why:** Blog posts go stale. Documentation is maintained alongside the code. React's rewritten docs (2023) are the best framework documentation in existence — better than any blog post about React.
- **When:** Any research on a specific technology. Start with its docs, then supplement with blogs for opinion and architecture.
- **Source:** [research/2026-02-13-engineering-sources-guide.md](../research/2026-02-13-engineering-sources-guide.md)

### Surveys for Reality, Blogs for Opinion
- **What:** State of JS/CSS, Stack Overflow Survey, and CNCF Annual Survey tell you what developers actually use. Blogs tell you what thought leaders recommend. Use both but don't confuse them.
- **Why:** There's often a gap between what's recommended and what's adopted. Redux usage is declining but still widespread. Kubernetes is "the standard" but most teams don't use it. Surveys ground recommendations in reality.
- **When:** Any research that involves tool recommendations or trend analysis.
- **Source:** [research/2026-02-13-engineering-sources-guide.md](../research/2026-02-13-engineering-sources-guide.md)

### Company Blogs for "How," Not "What"
- **What:** Netflix, Stripe, Uber, Cloudflare blogs show how to solve problems at scale. They don't help you pick tools (they'll recommend their own stack). Use them for architecture patterns and real-world case studies.
- **Why:** These teams operate at a scale most of us don't. Their solutions are educational but may not apply directly. Their tool choices reflect their specific constraints (JVM at Netflix, Ruby at Stripe).
- **When:** Researching architecture patterns, distributed systems, or understanding how large systems handle specific challenges.
- **Source:** [research/2026-02-13-engineering-sources-guide.md](../research/2026-02-13-engineering-sources-guide.md)

### Vendor Blogs: Read the Details, Ignore the Conclusion
- **What:** Pulumi's Terraform comparison has excellent technical details but will always recommend Pulumi. Same for every vendor. Read both sides of any "X vs Y" comparison. Extract the facts, form your own conclusion.
- **Why:** Vendor blogs are some of the best-written technical content because companies invest heavily in developer marketing. The technical substance is real — the framing is biased.
- **When:** Any tool comparison research. Always find at least two vendor perspectives.
- **Source:** [research/2026-02-13-engineering-sources-guide.md](../research/2026-02-13-engineering-sources-guide.md)

### Follow People, Not Platforms
- **What:** Individual blogs (Josh Comeau, Kent C. Dodds, Martin Fowler, Dan Abramov) produce more reliable content than any platform. Medium, dev.to, and other platforms have no editorial standards — quality depends entirely on the author.
- **Why:** Platforms optimize for volume and SEO. Individuals optimize for reputation. A post from Josh Comeau has more editorial care than 50 random Medium posts.
- **When:** Building a reading list or evaluating a source's reliability.
- **Source:** [research/2026-02-13-engineering-sources-guide.md](../research/2026-02-13-engineering-sources-guide.md)

### Hacker News as Signal
- **What:** Hacker News comments are often more valuable than the linked articles. Use `hn.algolia.com` to search for discussions on any engineering topic. What gets upvoted and debated by experienced engineers is a strong quality signal.
- **Why:** HN's audience skews toward experienced engineers. Contrarian views and criticisms surface quickly. If a tool or practice has problems, HN comments will find them.
- **When:** Validating claims from any source, or finding the "real" conversation around a topic.
- **Source:** [research/2026-02-13-engineering-sources-guide.md](../research/2026-02-13-engineering-sources-guide.md)

## Revision History
- 2026-02-13: Initial extraction from [research/2026-02-13-engineering-sources-guide.md](../research/2026-02-13-engineering-sources-guide.md).
