---
date: 2026-02-26
topic: How AI should learn
status: complete
tags: [reinforcement-learning, meta-learning, evolution, cooperation, game-theory, multi-agent, algorithm-discovery]
---

# How AI Should Learn

## Context

Two papers published within days of each other in February 2026 converge on a shared provocation: the most powerful learning algorithms may not be hand-designed at all. Both come from Google research labs, and both demonstrate that removing explicit architectural assumptions — letting standard methods operate over diverse, rich training distributions — yields behavior or algorithms that human designers couldn't anticipate.

**Paper 1**: Weis et al., Google Paradigms of Intelligence (arxiv 2602.16301, Feb 18, 2026). Trains sequence-model agents in the Iterated Prisoner's Dilemma against diverse opponents using standard decentralized RL. No meta-gradients, no explicitly programmed cooperation incentives. Cooperation emerges.

**Paper 2**: Li et al., Google DeepMind (arxiv 2602.16928, Feb 21, 2026). Uses AlphaEvolve — an LLM-driven evolutionary coding agent — to evolve the source code of game-solving algorithms. The discovered variants (VAD-CFR and SHOR-PSRO) outperform every human-designed baseline across 11 games.

Together, these papers press a single point: AI learning mechanisms should be derived from data and computation, not from human intuitions about what a learning rule should look like.

---

## Findings

### Paper 1: Emergence of Cooperation Without Meta-Gradients

**Source**: "Multi-agent cooperation through in-context co-player inference," Marissa A. Weis, Maciej Wołczyk, Rajai Nasser, Rif A. Saurous, Blaise Agüera y Arcas, João Sacramento, Alexander Meulemans. Google Paradigms of Intelligence team. arxiv:2602.16301.

#### The Core Problem

The Iterated Prisoner's Dilemma (IPD) is the canonical social dilemma. Two agents repeatedly choose cooperate or defect. Mutual cooperation yields the best collective outcome; individual defection is the dominant strategy at any single step. Getting agents to converge on cooperation through self-interested reward maximization is notoriously hard: rational agents defect, even though mutual defection leaves both worse off than mutual cooperation.

Prior approaches to solving this required expensive machinery: LOLA (Learning with Opponent-Learning Awareness) uses meta-gradients to model and shape the opponent's learning process; other approaches hard-code timescale separation between "naive learners" and "meta-learners." These methods work but introduce bespoke inductive biases that may not generalize.

#### The Setup

- **Environment**: 100-round IPD episodes.
- **Agent architecture**: GRU-based sequence model. The sequence model serves dual purposes — as a world model predicting future observations/rewards, and as a policy prior. Agents run Monte Carlo rollouts on the sequence model to estimate action values.
- **Training algorithm tested**: PPI (Predictive Policy Improvement, a novel method using sequence models with reweighted predictions) and A2C (Advantage Actor-Critic, standard decentralized RL).
- **Co-player distribution**: Mixed pool — 50% other learning agents, 50% random tabular policies.

#### What Happens

The sequence model's in-context learning capabilities allow agents to infer and adapt to their co-player's behavior from the interaction history within a single episode. This has a counterintuitive effect:

1. **Diversity induces in-context learning**: Training against random tabular policies forces the agent to build flexible inference machinery rather than memorizing fixed opponent strategies.

2. **In-context learners become exploitable**: Because agents adapt within episodes, an opponent who understands this can exploit the adaptive agent by shaping its learning trajectory — essentially "extorting" the in-context learner.

3. **Mutual extortion drives cooperation**: When two in-context-learning agents interact, they each try to extort the other. This competitive shaping paradoxically resolves into cooperation — both agents end up cooperating, not because cooperation was incentivized directly, but because mutual extortion is an equilibrium that happens to be cooperative.

The causal chain: **diversity → in-context learning → exploitability → mutual shaping pressure → cooperation.**

#### Key Results

- Both PPI and A2C achieve cooperation when trained with diverse co-player distributions.
- **Without diversity** (training only against other learners): agents collapse to defection.
- **Without in-context inference** (explicit opponent identification given): agents also collapse to defection.
- The paper provides theoretical backing: Local and Mixed Predictive Equilibria exist under reasonable continuity assumptions, and cooperation is a stable equilibrium of this system.

#### Implications for Foundation Models

The authors note a striking parallel: large language models are sequence models trained on diverse tasks, and they exhibit in-context learning. The paper's findings suggest that **the same mechanism driving cooperation in the IPD may be operating in LLM-based agents deployed in multi-agent settings**. Cooperative behavior in deployed AI systems may be an emergent property of scale and diversity, not a property that must be explicitly engineered — or it may be absent if the training distribution lacks the right structure.

This also resolves a longstanding debate in the meta-learning literature. MAML, LOLA, and related approaches require explicit separation between inner (fast) and outer (slow) loops. The sequence model approach unifies these: agents are naive learners on the fast in-episode timescale via in-context learning, and learning-aware agents on the slow across-episode timescale via weight updates. **No explicit timescale separation needed.**

---

### Paper 2: Evolving Game Solvers That Humans Couldn't Design

**Source**: "Discovering Multiagent Learning Algorithms with Large Language Models," Zun Li, John Schultz, Daniel Hennes, Marc Lanctot. Google DeepMind. arxiv:2602.16928.

#### The Core Problem

Game-theoretic algorithms — for finding Nash equilibria, minimizing regret, solving extensive-form games — have been designed by humans for decades. CFR (Counterfactual Regret Minimization) and PSRO (Policy Space Response Oracles) are the dominant paradigms. Over time, variants like DCFR, PCFR+, and Optimistic RM have improved on original CFR through manual insight. But this process is slow, depends on human intuition, and may miss entire regions of the design space.

The question: can an automated system find better algorithms by searching the space of possible code implementations?

#### AlphaEvolve as the Discovery Engine

AlphaEvolve (originally published May 2025, arxiv 2506.13131) is an evolutionary coding agent that orchestrates LLM-based mutation of program source code, guided by automated evaluation. Li et al. apply it to multiagent learning algorithm discovery.

**Program-as-genome**: The evolvable components are three Python classes:
- `RegretAccumulator` — logic for accumulating regret estimates
- `PolicyFromRegretAccumulator` — deriving a policy from regret
- `PolicyAccumulator` — updating the average policy during tree traversal

This design choice is significant: the search space exactly encompasses **the entire family of known CFR variants as special cases**, plus an unbounded space of novel variants. By specifying the right interface and leaving the implementation to evolution, the researchers avoid prematurely constraining what can be found.

**LLMs as semantic mutation operators**: Rather than genetic operators that make random bit-flips, LLMs understand the semantic content of the code. They can rewrite logic, introduce new control flows, inject novel symbolic operations. This is "semantic evolution" — mutation that preserves functional coherence while exploring genuinely novel mechanisms.

The evaluation loop uses imperfect-information games as fitness functions: **4 training games** (3-player Kuhn Poker, 2-player Leduc Poker, 4-card Goofspiel, 5-sided Liar's Dice), evaluated across **11 total games** including held-out variants (4-player Kuhn Poker, 3-player Leduc Poker, larger Goofspiel/Liar's Dice variants) to test generalization.

#### What Was Discovered

**VAD-CFR** (Volatility-Adaptive Discounted Counterfactual Regret Minimization):

The discovered algorithm introduces three non-intuitive mechanisms that no existing CFR variant combines:

1. **Volatility-adaptive discounting**: Uses exponential weighted moving averages to track learning instability. Increases discounting during high-volatility regret updates (aggressive forgetting when learning is noisy) and retains more history during stability.
2. **Asymmetric instantaneous boosting**: Amplifies positive regrets by 1.1× to accelerate exploitation of favorable strategies.
3. **Hard warm-start with regret-magnitude weighting**: Delays policy averaging until iteration 500, then weights policies by instantaneous regret magnitude rather than uniformly.

Each of these mechanisms is individually non-obvious. Together, they form a coherent strategy: be aggressive early (warm-start delay + volatility), exploit quickly (asymmetric boosting), then settle into a stable average (regret-weighted accumulation).

**Result**: VAD-CFR matches or exceeds state-of-the-art baselines (DCFR, PCFR+) in **10 of 11 games**. In 3-player Leduc Poker, it reaches exploitability below 10⁻³ while most baselines plateau higher.

---

**SHOR-PSRO** (Smoothed Hybrid Optimistic Regret PSRO):

Applied to the PSRO paradigm (population-based training), the evolved meta-solver dynamically blends:
- Optimistic Regret Matching (RM+) — for stability
- Boltzmann (temperature-controlled) strategy selection — for exploration

The blending factor anneals from 0.3 to 0.05 during training, with separate evaluation parameters for reactive assessment. Diversity bonuses encourage exploration when strategies become too concentrated.

**Result**: SHOR-PSRO outperforms state-of-the-art baselines in **8 of 11 games**, including environments with multi-agent dynamics that make convergence chaotic.

#### The "Humans Might Overlook" Observation

The paper notes that both discovered algorithms contain mechanisms "humans might overlook" — non-intuitive combinations of operations that violate common intuitions about what makes a good regret-minimization algorithm. This is the core argument for automated discovery: the space of valid algorithmic implementations is vastly larger than the space of implementations that feel reasonable to humans, and the best solution may be in the counterintuitive region.

---

### Broader Context: A Research Program Taking Shape

These two papers sit within a wider 2024–2026 research program exploring automated AI learning discovery:

**FunSearch → AlphaEvolve progression**: DeepMind's FunSearch (2023) evolved single mathematical functions, discovering improvements on cap-set problems. AlphaEvolve (May 2025) generalized this to entire codebases: it recovered 0.7% of Google's worldwide compute via data center scheduling improvements, improved Strassen-era matrix multiplication (4×4 complex matrices in 48 scalar multiplications, down from 49), and accelerated Gemini training by 1% via matrix kernel optimization. Li et al.'s game-solver paper is the next step in this progression — applying evolutionary code synthesis to learning algorithm design.

**DiscoRL** (Oh et al., Google DeepMind, Nature 2025): Rather than evolving code, DiscoRL uses meta-gradients to discover RL update rules parameterized as neural networks. Trained on a large population of agents across diverse environments, it discovered a learning rule that outperforms PPO, Rainbow, and other hand-designed algorithms on the full Atari benchmark, and generalizes zero-shot to ProcGen and other unseen environments. Notably, the discovered rule makes predictions with semantics distinct from any existing RL concept — it doesn't look like a value function or policy gradient; it's something new.

**COALA-PG** (Meulemans et al., 2024/2025, OpenReview): A precursor to the Weis et al. paper by some of the same authors (Meulemans is a co-author on both). Uses efficient sequence models to condition behavior on long observation histories containing traces of co-player learning dynamics. The Weis et al. paper refines this, showing that the mechanism works with standard RL (A2C) not just the specialized PPI algorithm.

---

### The Convergent Thesis

Synthesizing across these papers, a coherent view of "how AI should learn" is emerging:

**1. Diversity as the primary lever.** In both papers, diverse training distributions are the critical ingredient. Weis et al. show that training against a mixed pool of co-players — not a fixed opponent or self-play — drives the emergence of in-context adaptation and cooperation. Li et al. implicitly rely on the diversity of game configurations to ensure that discovered algorithms generalize. DiscoRL shows the same pattern: learning rules discovered from many diverse environments generalize to unseen environments, while rules from narrow distributions don't.

**2. Emergent meta-learning.** Explicit meta-gradient machinery (MAML, LOLA, gradient-through-time) is increasingly being shown to be unnecessary. Weis et al. demonstrate this directly: training sequence models against diverse opponents with standard RL implicitly induces the slow/fast loop structure of meta-learning. The meta-learning emerges from the training setup, not from the algorithm.

**3. Algorithmic inductive biases are liabilities.** Hand-coding a learning rule (Tit-for-Tat, DCFR, PCFR+) is a choice to concentrate probability mass on a particular algorithmic structure. By construction, you can't discover what you've ruled out. Both DiscoRL and the AlphaEvolve game-solver paper demonstrate that removing hand-coded biases (replacing them with learned neural networks or LLM-evolved code) reaches solutions outside the hand-coded design space.

**4. Program synthesis outperforms neural plasticity for interpretable algorithms.** DiscoRL discovers neural learning rules — efficient but opaque. AlphaEvolve discovers source code — interpretable and deployable without a trained meta-network. For game-theoretic algorithms, interpretability matters: you can reason about VAD-CFR, audit its convergence properties, and integrate it with existing theory. Neural learning rules don't offer this.

**5. Standard RL + right structure = cooperation.** Multi-agent AI systems don't necessarily need special alignment interventions to produce cooperative behavior. The social dilemma structure, combined with sequence models and diverse co-player distributions, can generate cooperation as a natural equilibrium. This has significant implications for how deployed AI agents might be expected to behave in adversarial or mixed-motive settings.

---

## Open Questions

1. **Scaling the Weis et al. result**: The IPD is a two-action, two-player game with clear payoffs. Does the same emergent cooperation mechanism hold in richer environments — stochastic games, partial observability, larger action spaces? The authors gesture at this but don't test it.

2. **Foundation model agents and social dynamics**: LLMs are sequence models trained on diverse data. Do the cooperation dynamics described in Weis et al. naturally appear when LLMs interact with each other? Early evidence from the multi-agent LLM literature (e.g., the October 2025 "Role of Social Learning and Collective Norm Formation" paper) is suggestive but not conclusive.

3. **AlphaEvolve scalability for harder games**: The 11-game benchmark uses imperfect-information but relatively small games. Does LLM-driven evolution find similarly superior algorithms for large-scale real-world settings (multi-player, continuous action spaces, real-time games)?

4. **Computational cost comparisons**: DiscoRL meta-training is expensive. AlphaEvolve evolutionary search is expensive. Standard RL with diverse co-players (Weis et al.) is comparatively cheap. How do these cost-performance tradeoffs play out at scale, and when is it worth paying for automated algorithm discovery vs. using discovered algorithms pre-packaged?

5. **Adversarial robustness of evolved algorithms**: VAD-CFR and SHOR-PSRO are optimized for empirical convergence on the training game distribution. Are they exploitable by adversaries who know the algorithm? Humans have centuries of game theory intuition to find exploits; automated discovery may produce algorithms with non-obvious vulnerabilities.

6. **Connection between in-context learning and reward alignment**: The Weis et al. mechanism — in-context learning renders agents susceptible to shaping — cuts both ways. A well-designed training distribution drives cooperative shaping. A poorly-designed or adversarial distribution might drive the same mechanism toward exploitation or defection. This is a safety consideration for deployed multi-agent systems.

---

## Extracted Principles

Distilled insights from this research → extracted to `principles/ai-learning-mechanisms.md` (new file):

- **Diversity over hand-coded structure**: Diverse training distributions are a primary driver of emergent adaptability; hand-coded learning rules are liabilities.
- **Emergent meta-learning from sequence models**: Explicit meta-gradient machinery is unnecessary when sequence models are trained across diverse tasks.
- **Program-as-genome for algorithm discovery**: LLM-driven evolutionary code synthesis reliably discovers non-intuitive algorithms that outperform human designs.
- **Social structure drives cooperation**: Standard RL in multi-agent settings with diverse co-players generates cooperative equilibria without explicit alignment interventions.
- **Code beats neural learning rules for deployability**: Evolved source code is interpretable, auditable, and integrable; neural learning rules are more flexible but opaque.
