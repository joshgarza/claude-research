# AI Learning Mechanisms

## Summary

How AI systems acquire their learning behaviors — and whether those behaviors should be hand-designed, meta-learned, or evolved. Synthesized from two February 2026 Google papers (Weis et al. on emergent cooperation in multi-agent RL; Li et al. on LLM-driven algorithm evolution) and the surrounding DiscoRL and AlphaEvolve research. The convergent thesis: minimizing architectural inductive biases and maximizing training distribution diversity consistently produces superior learning algorithms that humans wouldn't have designed.

## Principles

### Diversity Is the Primary Lever for Generalization
- **What:** Train AI systems against diverse distributions of tasks, opponents, or environments — not narrow hand-picked ones. Diverse training drives emergent adaptability far more reliably than architectural choices.
- **Why:** Weis et al. (2602.16301) show that cooperation in the Iterated Prisoner's Dilemma emerges only when agents are trained against a mixed pool (diverse co-players + random policies). Training against a narrow distribution (only other learners) collapses to defection. DiscoRL (Nature 2025) shows the same: the discovered RL rule generalizes to unseen environments only when discovered from a large diverse environment pool.
- **When:** Any ML training pipeline — multi-agent settings, meta-learning, algorithm discovery. If behavior doesn't generalize, the first diagnostic is training distribution breadth before architectural changes.
- **Source:** research/2026-02-26-how-ai-should-learn.md

### Sequence Models + Diverse Training = Emergent Meta-Learning
- **What:** Sequence models (GRUs, Transformers) trained on diverse tasks implicitly develop in-context learning that functions as fast meta-adaptation — without explicit meta-gradient machinery (MAML, LOLA).
- **Why:** Weis et al. prove this directly: GRU agents trained via standard decentralized RL (A2C) against diverse co-players develop in-context best-response strategies that implement the fast/slow loop of meta-learning. No explicit inner/outer loop required. This is likely the same mechanism enabling in-context learning in LLMs.
- **When:** Before reaching for MAML, LOLA, or other meta-learning frameworks, check if diverse training of a sequence model achieves the desired adaptation behavior. Meta-gradient machinery is justified only when the implicit route demonstrably fails.
- **Source:** research/2026-02-26-how-ai-should-learn.md

### Hand-Coded Learning Rules Are Inductive Biases — And Liabilities
- **What:** Manually designing a learning algorithm (CFR, PPO, Tit-for-Tat) concentrates search probability on a designer-constrained region. The best solution may be outside that region. When feasible, prefer automated discovery over manual design.
- **Why:** Li et al. (2602.16928) evolved game-solving algorithms via AlphaEvolve. The discovered algorithms (VAD-CFR: 10/11 games; SHOR-PSRO: 8/11 games) contain mechanisms "humans might overlook" — combinations that violate common intuitions but empirically outperform every manually designed baseline. DiscoRL discovered RL update rules with semantics that don't map to any existing RL concept.
- **When:** Algorithm design tasks where (a) automated evaluation is feasible and (b) performance is measurable. Not applicable when interpretability or safety auditability is paramount over raw performance.
- **Source:** research/2026-02-26-how-ai-should-learn.md

### Program-as-Genome: LLM Evolution Searches Semantically, Not Randomly
- **What:** Use LLMs as mutation operators in evolutionary code search. Unlike genetic bit-flip operators, LLMs understand program semantics and make coherent modifications: rewriting logic, introducing new control flows, injecting novel symbolic operations.
- **Why:** AlphaEvolve (2506.13131) and Li et al. (2602.16928) demonstrate that treating algorithm source code as the genome, with LLMs as semantic mutators, finds solutions in the non-intuitive region of the design space. The key design decision is specifying the right evolvable interface (e.g., three Python classes for CFR variants) that encompasses the known design space as special cases, while leaving implementations open.
- **When:** Algorithm discovery tasks with a clear automated fitness signal (exploitability, benchmark performance, efficiency). Also applicable to hyperparameter and architecture search where existing frameworks (NAS) are too constrained. Requires significant compute for the evolutionary loop.
- **Source:** research/2026-02-26-how-ai-should-learn.md

### Standard RL + Multi-Agent Structure = Cooperation Without Alignment Intervention
- **What:** In multi-agent settings, cooperative behavior can emerge from standard self-interested RL when agents use sequence models and face diverse co-players. No explicit cooperation rewards, no communication protocols, no alignment-specific training objectives needed.
- **Why:** The mechanism (Weis et al.): in-context learning makes agents susceptible to behavioral shaping; when two such agents interact, mutual shaping pressure paradoxically resolves to mutual cooperation as the stable equilibrium. The social dilemma structure, not explicit cooperation incentives, does the work.
- **When:** Designing multi-agent AI systems where cooperative behavior is desired. Note the safety implication: the same mechanism that drives cooperation under well-designed training distributions can drive exploitation under adversarial ones. Distribution design matters.
- **Source:** research/2026-02-26-how-ai-should-learn.md

### Evolved Code Beats Neural Learning Rules for Deployability
- **What:** When automated algorithm discovery is used, prefer evolved source code (interpretable, auditable, integrable) over evolved neural learning rules (flexible but opaque) unless the problem requires plasticity that code can't capture.
- **Why:** DiscoRL discovers neural update rules — powerful, but a black box. AlphaEvolve/Li et al. discover source code — you can read VAD-CFR, reason about its convergence properties, audit it against game-theoretic constraints, and deploy it without carrying a trained meta-network at inference time.
- **When:** Game-theoretic algorithms, optimization heuristics, data structure operations — anywhere the algorithm will be reused, audited, or extended by humans. Neural rules are appropriate for problems where the "algorithm" must adapt continuously (e.g., online learning update rules in highly non-stationary environments).
- **Source:** research/2026-02-26-how-ai-should-learn.md

## Revision History
- 2026-02-26: Initial extraction from research/2026-02-26-how-ai-should-learn.md (Weis et al. 2602.16301 + Li et al. 2602.16928).
