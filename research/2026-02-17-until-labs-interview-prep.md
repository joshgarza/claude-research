---
date: 2026-02-17
topic: Until Labs interview preparation
status: complete
tags: [interview-prep, biotech, cryopreservation, company-research]
---

# Until Labs — Interview Preparation

## Context
Preparing for an interview with Until Labs (untillabs.com), a cryopreservation biotech startup in San Francisco. Referred by a former founding engineer.

## Company Overview

**Until Labs** (formerly Cradle) builds reversible cryopreservation technology — cooling biological tissue to below -130C and reviving it fully functional. They frame it as "pausing biological time."

| Detail | Value |
|---|---|
| Founded | ~2024 (public emergence June 2024) |
| Team size | ~37 employees |
| Total funding | $100M+ ($48M seed + $58M Series A, Sep 2025) |
| Lead investors | Founders Fund, Lux Capital, Field Ventures |
| HQ | San Francisco, in-office |

## Founders

### Laura Deming (CEO & Co-Founder)
- Fascinated by aging at age 8; joined Cynthia Kenyon's longevity lab at 11
- Accepted to MIT at 14, dropped out for the Thiel Fellowship (2011 cohort)
- Founded The Longevity Fund (VC focused on aging/life extension) and AGE1 accelerator
- Nearly two decades in longevity research
- Values intellectual honesty, unconventional thinking, genuine obsession with problems over credentials
- Philosophy: advocates "falling in love" with scientific problems rather than pursuing them mechanically

### Hunter Davis (CSO & Co-Founder)
- University of Chicago and Caltech background
- Postdoc at Harvard in medical physics and biology
- Personal motivation: father-in-law Mark died of mesothelioma after a promising Keytruda trial opened too late — he was already too sick to qualify
- Described feeling "a profound powerlessness" despite his expertise; meeting Laura revealed cryopreservation as a solution

## The Problem

The organ transplant system is broken by time constraints:

- **103,000+** people on the US transplant waiting list
- **13 people die per day** waiting for a transplant
- **~50,000 potentially transplantable organs discarded per year** in the US alone
- **21% of donated kidneys and 58% of donated hearts** go unused in Europe
- No national tracking system for organs in transit

Current organ viability windows are extremely narrow:
- Hearts, lungs, livers: **4–12 hours** post-procurement
- Kidneys: **24–36 hours** maximum

Organs are wasted because there isn't enough time to match, transport, or prepare recipients. If you could preserve organs indefinitely and rewarm them on demand, you eliminate the time bottleneck entirely — better matching, fewer discards, more lives saved.

## Technology

### Core approach: Vitrification
Cooling tissue so water transitions to a glass-like state rather than forming ice crystals (which destroy cells). This is a critical distinction — "glass, not ice."

### Five technical dimensions
1. **Cryoprotective agents (CPAs)** — molecules perfused into organs to suppress ice formation
2. **Perfusion systems** — hardware to deliver CPAs throughout organ vasculature
3. **Cooling protocols** — controlled temperature reduction below -130C
4. **Volumetric rewarming** — the hardest part; warming must be uniform to avoid cracking or ice formation. They built a custom electromagnet for this
5. **Organ health assessment** — verifying function post-revival

### Three research focus areas
- **Molecular discovery:** enhanced CPA efficacy, biocompatible formulations, improved biodistribution
- **Surgical protocols:** organ perfusion systems, transplant model procedures, microsurgery techniques
- **Engineering systems:** volumetric rewarming, high-throughput screening platforms, material physics instrumentation

### Key milestone (2024)
Recovery of electrical activity from cryopreserved and rewarmed acutely resected rodent neural tissue — published as Milestone White Paper I.

### Public roadmap
1. Neural tissue electrical activity recovery (completed 2024)
2. Preclinical donor organ validation
3. First-in-human organ trial
4. Two-hour hypothermic rodent preservation
5. Reversible whole-body rodent cryopreservation

Long-term vision: whole-body medical hibernation.

## Software Engineering at Until

### Tech stack
Python, TypeScript, React, Django, JavaScript, HTML/CSS, Google Cloud Platform, Elasticsearch. IaC tools (Terraform/Pulumi) preferred. SQL/relational databases.

### What software engineers build
- Data pipelines for experimental data
- Lab automation interfaces
- Cloud-based infrastructure
- High-throughput screening platforms
- Imaging/microscopy systems software

### Current open roles (as of Feb 2026)
- Software Engineer
- Machine Learning Engineer/Scientist
- Senior Cryogenic Systems Engineer
- Engineer, Hibernation Team
- Head of Legal

## Culture

- **Mission-driven** — "every line of code, every lab protocol, every design review serves one goal: give patients more time"
- **Interdisciplinary** — chemists, physicists, biologists, surgeons, engineers, data scientists working together
- **Intellectually honest** — acknowledge "significant scientific uncertainty" and "audacious solution" upfront
- **Startup pace** — fast, demanding, small team
- **In-office** in San Francisco
- **Unconventional credentials welcome** — founders value genuine intellectual obsession over pedigree

## Interview Strategy

### "Why Until?"
- Connect to the mission personally if possible
- Demonstrate understanding of the problem's scale (50K discarded organs/year, 13 deaths/day)
- Reference the founders' stories to show deep research
- Emphasize the rare intersection of software engineering and frontier science

### "Why this role?"
- Building systems that directly enable scientific breakthroughs, not CRUD apps
- Small team = high ownership and direct impact on outcomes
- Interdisciplinary environment where software directly interfaces with lab hardware and scientific workflows

### Likely technical areas
- Data pipeline design for scientific/experimental data
- Lab automation and hardware integration
- Cloud infrastructure on GCP
- Python and TypeScript proficiency
- Collaborating with scientists who aren't software engineers
- Handling messy, evolving data from experiments

### Questions to ask them
1. "What does the day-to-day look like for software engineers — how closely do you work with the science team?"
2. "Which part of the tech stack is most critical right now — data pipelines, lab automation, or something else?"
3. "What's the biggest engineering challenge you're facing that isn't a science problem?"
4. "How do you prioritize software work when the research direction can shift?"
5. "What milestone is the team most focused on hitting next?"
6. "How has the team changed since the Series A?"

### Conversation starters that demonstrate research depth
- Reference the neural tissue milestone and ask about progress toward large-animal organ work
- Mention the "Glass, Not Ice" blog post — shows you understand vitrification vs. freezing
- Ask about the custom electromagnet for rewarming — shows you read their roadmap
- Reference Hunter's personal motivation from the founder letter
- Ask about scaling challenges from embryo-sized samples to whole organs

### Leverage your referral
Your referrer is a former founding engineer. Before the interview:
- Ask them about team dynamics and what they valued most
- Ask what the interview process looks like and what they emphasize
- Ask about the early technical decisions and how the stack evolved
- Their endorsement carries significant weight at a 37-person company

## Sources
- [Until Labs Website](https://www.untillabs.com/)
- [Founder Letter](https://www.untillabs.com/blog/founder-letter)
- [Problem Statement & Roadmap](https://www.untillabs.com/blog/problem-statement-and-roadmap)
- [Glass, Not Ice (Blog)](https://www.untillabs.com/blog) — Nov 2025
- [Series A Announcement — BioSpace](https://www.biospace.com/press-releases/until-labs-announces-58m-series-a-funding-round-to-develop-an-organ-cryopreservation-product-for-transplant-patients-and-surgeons)
- [Laura Deming Interview — The Generalist](https://www.generalist.com/p/biological-time-travel-laura-deming)
- [Cryopreservation Startup $58M — Longevity Technology](https://longevity.technology/news/cryopreservation-startup-lands-58m-to-pause-biological-time/)
- [Until Labs — Built In SF](https://www.builtinsf.com/company/until-labs)
- [Laura Deming — Wikipedia](https://en.wikipedia.org/wiki/Laura_Deming)
- [Organ Donation Statistics — organdonor.gov](https://www.organdonor.gov/learn/organ-donation-statistics)
- [Hunter Davis — Crunchbase](https://www.crunchbase.com/person/hunter-davis-525b)
