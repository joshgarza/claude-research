---
date: 2026-02-18
topic: Refactor Games interview preparation
status: complete
tags: [interview-prep, gaming, startup, company-research]
---

# Refactor Games — Interview Preparation

## Context
Preparing for an interview with Refactor Games, a physics-based sports gaming startup. Interviewers are Nathan Burba (CEO & Co-Founder) and Summer Perry (former CPO of UbiquityVX, role at Refactor unclear but senior leadership).

## Company Overview

**Refactor Games** builds experimental, physics-driven sports video games. Their core thesis: games have gotten too complex and scripted — they want to bring back pick-up-and-play immediacy through emergent physics-based gameplay.

| Detail | Value |
|---|---|
| Founded | March 2021 (public launch January 2022) |
| Team size | ~8-17 (growing — 17 jobs listed on Indeed) |
| Funding | $43.4K crowdfunding (StartEngine, June 2023); a16z Speedrun accelerator (up to $1M + $5M credits) |
| Valuation | $9.99M (StartEngine round) |
| Lead investors | Andreessen Horowitz (a16z Speedrun) |
| HQ | Santa Monica, CA |
| Key partnership | Delphi Interactive — building the Netflix FIFA game for World Cup 2026 |

## Founders & Leadership

### Nathan Burba (CEO & Co-Founder)
- **Education:** BA in Computer Science from Ithaca College (~2008); MFA in Interactive Media at USC School of Cinematic Arts (2011–2014)
- **Co-Founded Survios** — one of the earliest and most successful VR game studios. Raised $54M+, grew to 100+ employees, MGM-backed
- **Project Holodeck at USC** — directed one of the first consumer-oriented full-body VR systems. Collaborated with Palmer Luckey (Oculus founder). Open-sourced designs at Maker Faire 2012
- **Raw Data** — first VR game to hit $1M revenue in a month, first VR game to reach #1 on all of Steam, VR Game of the Year 2017
- **Other Survios titles:** Sprint Vector, Electronauts (Lumiere Award), Creed: Rise to Glory, Westworld Awakening, The Walking Dead: Onslaught
- Transitioned from CEO to President at Survios in 2018 when Seth Gerson was named CEO; left by early 2022
- **Published author:** *Cocos2d for iPhone 1 Game Development Cookbook* (Packt Publishing, 2011) — best-selling, 100+ recipes
- **Academic:** 2 IEEE VR papers (one co-authored with Palmer Luckey), 66 Google Scholar citations, 2 patents pending
- Self-describes as "a versatile software engineer, art and technology generalist and entrepreneur"
- **Philosophy:** Games should be simple, fun, and accessible but also deep, emergent, and heavily moddable. Anti-complexity. Values work culture over sales metrics. Dog-friendly office.

### Arman Megurditchian (Co-Founder & CCO / Art Director)
- Background in 3D art, technical art, and projection mapping
- Previous roles at XR Foundation, CINEMOI, Hutch App, Plan A Lab

### Stephen Everest (COO & Executive Producer)
- Initially VP of Business Development; promoted April 2025
- Key role in the Delphi Interactive / Netflix FIFA partnership

### Jalal Khan (Chief Creative Officer)

### Known Engineers
- **Rachel Miller** — Full Stack Developer (TypeScript, Prisma, PostgreSQL, NestJS, Jest, GraphQL)
- **Yale Buckner** — Game Development Engineer
- **Noah Fischer** — UE5 blueprint scripting, C++, Python; gameplay mechanics

**Team background:** Talent from Survios, OneTeam Partners, Wizards of the Coast, N3TWORK, EA Sports, 2K, Blizzard, Riot Games.

## Products

### 1. Football Simulator (Released — Steam Early Access)
- **Price:** $15.99–$20
- **Reviews:** Mostly Positive (79% of 859 reviews)
- **Core innovation:** Sports Physics Engine — creates unique animations every frame. Real-time ragdolls simulate realistic players who stumble, regain balance, grab/drag, break tackles, box out defenders. No pre-canned animations.
- RPG Season Mode, local co-op (up to 4), replay system, full mod support (mod.io)
- **Planned:** Cross-platform online multiplayer, VR support, online leagues, expanded RPG mode
- Built in **Unity**

### 2. Netflix FIFA Game (In Development — Partnership with Delphi Interactive)
- **Target release:** Summer 2026 (timed for FIFA World Cup 2026)
- **Platform:** Netflix Games (streaming to TVs, phones as controllers)
- Ground-up rebuild of FIFA soccer simulation
- CTO: **Julien Merceron** — former Konami technology director, created Fox Engine (Metal Gear Solid 5, PES/eFootball)
- Built in **Unreal Engine 5**
- Small, veteran-focused team structure — experienced designers/engineers over large headcount
- Refactor operates out of Delphi's LA headquarters for this project

### 3. Journeyman (In Development)
- 1–10 player co-op ARPG/CRPG hybrid
- Nathan describes it as "basically WoW meets Dark Souls"
- Souls-inspired combat, deep character customization, procedural dungeon content, PvP
- Wishlist available on Steam

### 4. Battleground Mars (In Development)
- Action shooter — players control clones of billionaires fighting for control on Mars
- Status unclear

## Technology Stack

| Layer | Technologies |
|---|---|
| Game engines | Unity (Football Simulator), Unreal Engine 5 (FIFA/soccer project) |
| Core tech | Custom Sports Physics Engine (proprietary) |
| Languages | C++, Python, TypeScript, Blueprint scripting |
| Web/backend | TypeScript, NestJS, Prisma, PostgreSQL, Jest, GraphQL |
| Motion capture | Sony mocopi Professional Mode (12-sensor wireless system) + mocopi Receiver Plugin for Unity |
| Modding | mod.io |

### Sony mocopi Partnership
Refactor is a **featured case study** on Sony's XYN platform. They use wireless motion capture bands for real-time sports animation — developers wear bands, record animations, and can import/test within 20 minutes. Exploring player-driven animation where users create and share personalized movement in-game.

## Culture & Values

- **Pick-up-and-play philosophy** — immediacy over complexity
- **Emergent gameplay** — physics creates unique moments, not scripts
- **Community-driven** — Discord community involved in design; modding is first-class
- **Small, experienced team** — AAA backgrounds with indie agility
- **Anti-annual-release** — no yearly $60 updates; one game that evolves with the community
- **Casual, creative environment** — Nathan values friendships at work, mentoring, beer on a Tuesday afternoon

## Interviewer: Nathan Burba (CEO)

**What this tells you about the interview:**

**He's a technical founder and generalist.** He codes, does art, designs games, writes, researches, and manages. He'll respect someone who can wear multiple hats and go deep where needed.

**He built the VR industry.** He co-founded Survios alongside Palmer Luckey's early work. He knows what it's like to build technology that doesn't exist yet. He'll value someone comfortable with ambiguity and novel technical challenges.

**He cares about culture over metrics.** He explicitly says he takes more pride in creating the right work environment than in sales records. Show that you care about the craft and the team, not just shipping features.

**He's anti-complexity.** His core design philosophy is that games (and by extension, systems) should be simple, accessible, and deep — not bloated. This likely extends to how he thinks about engineering. Don't over-engineer your answers.

**He's a published author and academic.** He'll appreciate intellectual depth and rigor, but he's not pretentious about it. He open-sourced Project Holodeck and values accessibility.

**Common ground to find:**
- His USC MFA was in Interactive Media — he thinks about the intersection of art, technology, and design
- His physics engine is the core IP — if you can talk about simulation, emergent systems, or physics-based computation, that's gold
- He raised $54M+ at Survios and bootstrapped Refactor on crowdfunding — he knows both worlds

**Questions to ask Nathan:**
1. "What made you leave VR after a decade and go back to traditional gaming with Refactor?"
2. "The Sports Physics Engine is the core differentiator — how do you think about extending it beyond football to soccer, basketball, and other sports?"
3. "How does the Netflix FIFA partnership change what you're building at Refactor? Is the physics engine shared across projects?"
4. "You've built 100+ person companies and now you're running an 8-person team again — what's different this time about how you want to build?"
5. "With the Sony mocopi partnership, you're exploring player-driven animation — where does that go long-term?"

## Interviewer: Summer Perry

**Role at Refactor Games:** Not clearly documented publicly. Her LinkedIn still lists CPO at UbiquityVX as primary. However, Nathan posted in December 2023 that "Summer Perry is looking for a Personal Assistant. Come work at Refactor Games and UbiquityVX" — implying she holds a leadership role at both companies simultaneously.

### Background

**Career arc:** Hollywood acting → VR gaming → biotech/pharma → healthcare tech → gaming

| Period | Company | Role |
|---|---|---|
| ~2009–ongoing | SAG-AFTRA | Actress (50+ film/TV productions) |
| ~2017–2018 | Survios, Inc. | Product Marketing Manager |
| ~2019+ | Fallene Cosmeceuticals | Product Marketing Manager |
| ~2020–2021 | Wenkert & Young, LLC | Pharmaceutical R&D |
| ~2020–present | Biohackers.guide | Co-Founder & Host |
| ~2022–2023 | Project City | Product Marketing & Instructional Design |
| Ongoing | Wong Lab, UCLA | Research Assistant (Bioengineering, David Geffen School of Medicine) |
| Ongoing | UbiquityVX | CPO (Chief Product Officer) |
| Current | Refactor Games | Senior leadership (title unclear) |

### Key Achievements
- **Survios VR Arcade** — managed launch of "the most profitable virtual reality experience in the Western Hemisphere" at Del Amo Fashion Center, Torrance, CA (Feb 2018). 75% sales increase. Tencent partnership.
- Grew social media following with 80% engagement increase, maintained 100% response rate on all social channels
- Produced and hosted 30+ launch and promotional events
- Co-founded Biohacker's Guide to the Galaxy podcast — focused on transparency and ethics in science/medicine

### Education
- Santa Monica College — active in Phi Theta Kappa honors society, STEM Program, UCLA/SMC Student Research Initiative, Women in STEM
- Pre-med track — Instagram bio references "AAMC premed student at UW Medicine"
- UCLA — Research at Wong Lab in Bioengineering at David Geffen School of Medicine

### Entertainment Background
- SAG-AFTRA member, 50+ productions
- Photo double for Scarlett Johansson, Naomi Watts, Kristen Bell, Christina Applegate
- Credits include: A Star Is Born (2018), Happy Death Day (2017), The Disaster Artist, Glee, CSI

### UbiquityVX Connection
UbiquityVX is a **virtual therapy platform** — WebXR-based (works in any browser, no headset required), marker-less motion capture through any camera, AI + human therapist telepresence, ML-driven patient progress tracking. Use cases: physical therapy, occupational therapy, autism treatment.

The UVX team includes Brett Leonard (directed The Lawnmower Man), Dr. Albert "Skip" Rizzo, and other VR/healthcare pioneers. Both Nathan Burba and Summer Perry are listed on the UVX team — this is where they worked together after Survios.

### What This Tells You About The Interview

**She's a product and marketing leader, not an engineer.** Expect her to probe:
- How you communicate with non-technical stakeholders
- Your understanding of user experience and community
- Whether you think about the player/user, not just the code
- How you prioritize and make product tradeoffs

**She bridges wildly different domains.** Acting, VR, pharma, bioengineering, healthcare tech, gaming — she values versatility and adaptability. Show breadth, not just depth.

**She's community-obsessed.** 100% social media response rate, 30+ launch events, Discord community management. She'll care about how engineering serves the community.

**She comes from marketing/product, not engineering.** Frame your technical work in terms of impact, user value, and outcomes — not implementation details.

**Common ground to find:**
- The Survios VR Arcade was a physical product launch — if you've worked on anything customer-facing, draw parallels
- She co-founded a health/science podcast — she values science communication and transparency
- She's pursuing pre-med while working in tech — she understands the drive to learn across domains

**Questions to ask Summer:**
1. "How does your product thinking at UbiquityVX (healthcare, accessibility) influence what you're building at Refactor?"
2. "You've launched VR arcades, healthcare platforms, and games — what's the common thread in how you think about product?"
3. "How does the community (Discord, modders) shape the product roadmap at Refactor?"
4. "What's the relationship between Refactor Games and UbiquityVX — do they share technology or team?"

## Interview Strategy

### "Why Refactor?"
- The physics engine is genuinely novel — emergent gameplay from first principles, not scripted animations. That's an engineering challenge you can't find at most companies.
- Small team with AAA pedigree — high ownership, working alongside people from Survios, EA Sports, 2K, Blizzard, Riot
- The Netflix FIFA partnership is a massive opportunity — building a soccer game for World Cup 2026 on a new platform
- a16z backing signals legitimacy; Nathan's track record ($54M raised, VR GOTY, Palmer Luckey collaborator) reduces founder risk
- Anti-annual-release model — building one evolving product with community, not shipping throwaway yearly updates

### "Why this role?"
- Building systems that power emergent, physics-driven gameplay — not CRUD apps
- Full-stack opportunity — the stack spans game engines (Unity/UE5), web backend (NestJS/PostgreSQL/GraphQL), and tooling
- Multiple products in different stages — Football Simulator (live), Netflix FIFA (in development), Journeyman (greenfield)
- Small team = direct impact on what ships

### Likely Technical Areas — With Project Parallels (STAR Format)

---

#### 1. Full-Stack Web Development (NestJS, TypeScript, PostgreSQL, GraphQL)

**Best project: Wedding Venue Finder** — Full-stack TypeScript app with Express 5, PostgreSQL (pgvector + PostGIS), Knex migrations, JWT auth, React frontend.

- **Situation:** Needed to build a venue recommendation system from scratch with no existing dataset. Required a full-stack application with API, database, and frontend.
- **Task:** Design and build a complete application: REST API, PostgreSQL database with vector similarity search, React frontend with swipe-based UX.
- **Action:** Built Express 5 API with JWT authentication, PostgreSQL 17 with pgvector (512-dim CLIP embeddings) + PostGIS for geospatial queries, Knex migrations for schema management, React frontend with swipe-based onboarding. 223 tests with Vitest.
- **Result:** Full-stack application that transforms raw web data into personalized venue recommendations. Users swipe 10 images and get taste-matched results.

**Supporting project: Dashboard** — Express 5 + React 19, multi-source data aggregation, Docker Compose.

**Talking point for Refactor:** "Your backend uses NestJS, Prisma, PostgreSQL, and GraphQL — I've built production TypeScript APIs with the same database and similar patterns. The framework specifics (Express vs. NestJS, Knex vs. Prisma) are swappable; the architecture thinking is the same."

---

#### 2. Data Pipelines & Tooling

**Best project: Wedding Venue Finder** — 6-stage pipeline: collect → pre-vet → crawl → extract → enrich (LLM) → embed (CLIP).

- **Situation:** No structured venue dataset existed. Had to create one from raw web data across hundreds of sources.
- **Task:** Design a multi-stage pipeline that transforms unstructured web content into structured, queryable, vector-embedded data.
- **Action:** Built 6-stage pipeline: (1) Collect from OpenStreetMap Overpass API, (2) Pre-vet with keyword filtering (40-60% false positive reduction), (3) BFS web crawl with Playwright via crawl4ai (depth 2-3, rate-limited), (4) Image extraction/download, (5) LLM enrichment (Ollama/phi3) for structured field extraction, (6) CLIP embeddings (512-dim) stored in pgvector. Error isolation at each stage.
- **Result:** ~1000 raw candidates → fully enriched, vector-embedded records with structured metadata, images, and similarity-searchable embeddings.

**Talking point for Refactor:** "Game studios need data pipelines for everything from analytics to mod management to player data. I've built multi-stage pipelines that handle messy inputs, normalize data, and produce clean structured output — the same patterns apply whether the data comes from web crawlers or game servers."

---

#### 3. Real-Time Systems & Automation

**Best project: Knowledge Center** — Filesystem monitoring + automated ML indexing pipeline.

- **Situation:** Wanted real-time semantic search over a codebase without manual re-indexing.
- **Task:** Build a system that detects file changes, chunks content intelligently, generates embeddings, and keeps a vector database in sync — automatically.
- **Action:** Docker Compose service with Watchdog for filesystem monitoring (inotify for native paths, PollingObserver for mounted). Language-aware text splitting (different chunking for TypeScript, Python, Go vs. markdown). SentenceTransformers embeddings (all-MiniLM-L6-v2). ChromaDB vector storage. Debounced indexing (2-second quiet window). Soft deletes for recovery. MCP server for search.
- **Result:** Fully automated — change a file, and within seconds it's chunked, embedded, and searchable.

**Talking point for Refactor:** "Real-time event processing is core to game development — whether it's physics callbacks, player input, or server events. I've built systems that monitor hardware-level events, debounce signals, and trigger ML pipelines in real-time."

---

#### 4. Docker & Infrastructure

**Best project: Wedding Venue Finder** — 5+ containerized services orchestrated with Docker Compose.

- **Situation:** The application required PostgreSQL (PostGIS + pgvector), a Playwright web scraper, Ollama (local LLM), CLIP API server, Express API, and React frontend — all needing to communicate.
- **Task:** Containerize and orchestrate everything so the system runs with `docker compose up`.
- **Action:** Built Docker Compose config with 5+ services, configured networking, health checks, volume mounts, and environment-based configuration.
- **Result:** Full system reproducible on any machine with Docker. All services communicate over internal Docker network.

**Supporting project: USDR-GOST** — Contributed to production government grants platform with Terraform IaC.

**Talking point for Refactor:** "Game development depends on reproducible build environments, CI/CD, and dev infrastructure. I've designed multi-service Docker architectures from scratch and worked with Terraform-managed production infrastructure."

---

#### 5. Modding, Community, & User-Generated Content

**Best project: Job Search Pipeline** — YAML-driven configuration that non-engineers can modify.

- **Situation:** Needed a filtering system for job listings where criteria change frequently without code changes.
- **Task:** Build a configurable pipeline where filter rules are data, not code.
- **Action:** Built 5 independent YAML-driven filter modules (role, location, company, tech stack, experience). Anyone can adjust filters by editing YAML without touching code. Dry-run support for previewing without side effects.
- **Result:** Reduced ~300+ scraped jobs to ~20 high-quality leads per run. Filters evolved dozens of times without code changes.

**Talking point for Refactor:** "Refactor's modding-first philosophy (mod.io, fully customizable rosters/jerseys/teams) requires engineering that treats user configuration as a first-class concern. I've built systems where the configuration layer is as important as the code — YAML-driven filters, environment-based config, user-customizable pipelines."

---

#### 6. Physics, Simulation & Emergent Systems

**Best project: Wedding Venue Finder** — CLIP embeddings + vector similarity + real-time learning (emergent taste matching).

- **Situation:** Needed to match users to venues by aesthetic preference — not hardcoded rules, but emergent similarity.
- **Task:** Build a taste-matching system using image embeddings and vector similarity that improves with interaction.
- **Action:** Integrated CLIP (ViT-B/32) for 512-dimensional image embeddings. pgvector for cosine similarity search. Real-time profile learning: each right-swipe pulls the user's embedding centroid 10% toward the venue (learning rate 0.1). Confidence scores from standard deviation. Matched profiles to 14 aesthetic word embeddings for human-readable descriptors.
- **Result:** Personalized venue rankings from just 10 swipes. Profile evolves with continued interaction — the system exhibits emergent behavior from simple rules.

**Supporting project: Atropos** — Contributed to RL training framework for LLMs (FastAPI, Pydantic, PyTorch, vLLM, distributed training).

**Talking point for Refactor:** "Refactor's Sports Physics Engine creates emergent gameplay from first-principles physics — not scripted animations. I've built systems where simple rules produce emergent behavior: embedding similarity + learning rate = a taste profile that 'discovers' what you like without being told. The physics engine philosophy and the ML embedding philosophy share the same core idea: define the rules, let the behavior emerge."

---

#### 7. Collaborating with Non-Engineers

**Best project: USDR-GOST** — Building tools for government officials.

- **Situation:** US Digital Response builds tools for state and local government officials managing federal grants — users who are not engineers.
- **Task:** Contribute to a grants management platform that must be intuitive for non-technical users handling compliance reporting.
- **Action:** Worked within a large cross-organizational team. The tool handles ARPA compliance where end users are policy people, not engineers.
- **Result:** Production tool serving government officials nationwide at grants.usdigitalresponse.org.

**Talking point for Refactor:** "Refactor's team includes artists, designers, producers, and marketing — not just engineers. At Until Labs I'd serve scientists; at Refactor I'd serve game designers and content creators. I've built tools for non-technical users and worked in interdisciplinary teams."

---

### Questions to Ask Them

1. "What does the software engineering work look like day-to-day — is it mostly game engine work, backend/web systems, tooling, or a mix?"
2. "How does the Netflix FIFA project change the team's focus? Is Refactor splitting between Football Simulator and the FIFA game, or shifting entirely?"
3. "What's the biggest engineering challenge right now that isn't a game design problem?"
4. "How do you think about the Sports Physics Engine as a platform — is the long-term vision one engine powering multiple sports games?"
5. "What's the modding infrastructure like under the hood? How much engineering goes into making Football Simulator moddable?"
6. "The team has people from Survios, EA Sports, 2K, Blizzard, Riot — how does that mix of backgrounds shape the engineering culture?"

### Conversation Starters That Demonstrate Research Depth

- Reference the **Sony mocopi partnership** and ask about real-time motion capture workflow — shows you read the XYN case study
- Mention the **Sports Physics Engine** generating unique animations every frame — shows you understand their core differentiator vs. Madden's pre-canned animations
- Ask about the **transition from Unity (Football Simulator) to UE5 (Netflix FIFA)** — shows you understand their technical evolution
- Reference Nathan's **Project Holodeck** and collaboration with Palmer Luckey — shows you know his origin story, not just his current title
- Mention the **mod.io integration** and community-driven development — shows you understand their anti-annual-release philosophy
- Ask Summer about the **Survios VR Arcade launch** and how that experience shapes her product thinking at Refactor — shows you researched her specifically

### Red Flags to Be Aware Of

- **Funding is thin.** $43.4K crowdfunding + a16z Speedrun (up to $1M) is modest. The Delphi/Netflix partnership likely provides contract revenue, but the company's own capitalization is unclear. Worth asking about runway.
- **Team size uncertainty.** Tracxn says ~8, Indeed lists 17 jobs — either they're growing fast or the job listings are aspirational. Ask about current team size and hiring pace.
- **Summer's role is ambiguous.** Her LinkedIn still says CPO at UbiquityVX. She may split time between Refactor and UVX. Clarify her involvement.
- **Football Simulator reviews are declining.** 79% all-time positive but 54% recent. Ask what the team is doing about player sentiment.
- **Multiple simultaneous games.** Football Simulator, Netflix FIFA, Journeyman, and Battleground Mars for a small team is a lot. Ask about focus.

## Sources
- [Refactor Games Website](https://www.refactorgames.com/)
- [GamesBeat: Survios cofounder creates Refactor Games](https://gamesbeat.com/survios-cofounder-creates-refactor-games-to-build-football-simulator/)
- [Insider Gaming: The Indie Initiative Ep 1 — Refactor Games](https://insider-gaming.com/the-indie-initiative-episode-1-refactor-games/)
- [a16z Speedrun: Refactor Games](https://speedrun.a16z.com/companies/refactor-games)
- [Sony XYN Case Study: Refactor Games](https://xyn.sony.net/en/case/refactor-games)
- [Operation Sports: Football Simulator Preview](https://www.operationsports.com/football-simulator-hands-on-preview/)
- [Steam: Football Simulator](https://store.steampowered.com/app/1488560/Football_Simulator/)
- [Kingscrowd: StartEngine Review](https://kingscrowd.com/refactor-games-on-startengine-2023/)
- [SEC EDGAR: Offering Memorandum](https://www.sec.gov/Archives/edgar/data/1966574/000166516023000424/offeringmemoformc.pdf)
- [Outlook Respawn: Netflix FIFA CTO](https://respawn.outlookindia.com/gaming/gaming-news/former-konami-tech-chief-joins-delphi-to-oversee-netflix-fifa-game)
- [PocketGamer.biz: Delphi Interactive CTO](https://www.pocketgamer.biz/delphi-interactive-appoints-ex-konami-tech-director-julien-merceron-as-new-cto/)
- [Variety: Survios CEO Transition](https://variety.com/2018/digital/news/survios-seth-gerson-ceo-1202752736/)
- [Built In LA: CEOs to Know — Nathan Burba](https://www.builtinla.com/2016/12/09/ceos-know-survios-nathan-burba)
- [Fast Company: Raw Data $1M Milestone](https://www.fastcompany.com/3063747/how-to-make-a-million-dollars-in-vr-release-an-expensive-game)
- [Road to VR: Project Holodeck Interview](https://www.roadtovr.com/project-holodeck-demo-interview-director-nathan-burba-video/)
- [Nathan Burba — Crunchbase](https://www.crunchbase.com/person/nathan-burba)
- [Nathan Burba — Google Scholar](https://scholar.google.com/citations?user=EVKNqv4AAAAJ&hl=en)
- [Nathan Burba — LinkedIn](https://www.linkedin.com/in/burba/)
- [Summer Perry — LinkedIn](https://www.linkedin.com/in/summerperry/)
- [UbiquityVX Website](https://www.ubiquityvx.com/about)
- [Authority Magazine: UbiquityVX Startup Revolution](https://medium.com/authority-magazine/startup-revolution-brett-leonard-summer-perry-belinda-lange-walter-greenleaf-albert-skip-cee109ecdd3d)
- [Variety: Survios VR Arcade Launch](https://variety.com/2018/digital/news/survios-vr-arcade-1202660361/)
- [TechBullion: UbiquityVX Healthcare](https://techbullion.com/from-hollywood-to-virtual-therapy-how-ubiquityvx-is-revolutionizing-healthcare-access/)
- [Summer Perry — IMDB](https://www.imdb.com/name/nm2796349/)
- [The Org: Refactor Games](https://theorg.com/org/refactor-games)
- [Tracxn: Refactor Games](https://tracxn.com/d/companies/refactor-games/__rBFb3vROzHkbPyLUKQsvtrvumZbdt4sUmbBxGkXyrUk)
