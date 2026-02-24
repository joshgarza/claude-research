# Randomized Algorithms

## Summary

Randomized algorithms introduce deliberate probabilistic choices to gain efficiency benefits over deterministic algorithms. Freivalds' algorithm (1977) is the canonical introductory example: it verifies matrix multiplication in O(n²) with one-sided error ≤ 2^{-k} after k rounds — faster than all known deterministic approaches. Key themes: one-sided vs two-sided error, error amplification by repetition, fingerprinting as a unifying framework, and the BPP/RP complexity class hierarchy.

## Principles

### One-Sided Error is Stronger Than Two-Sided Error
- **What:** An algorithm with one-sided error (e.g., never false negatives, at most 1/2 false positives) is more useful than an equivalent two-sided (BPP) algorithm because one class of answers is always trustworthy.
- **Why:** You can use "NO" answers from Freivalds unconditionally; only "YES" answers carry residual uncertainty. This matters in verification and certification scenarios.
- **When:** Design randomized algorithms to have one-sided error when possible. Freivalds' algorithm is in RP (not just BPP) because false negatives are impossible by construction.
- **Source:** [research/2026-02-24-frievalds-algorithm.md](../research/2026-02-24-frievalds-algorithm.md)

### Error Amplification by Independent Repetition
- **What:** Run a randomized algorithm k times independently; if any run returns FALSE (for one-sided error), the overall answer is FALSE. Otherwise return TRUE. Error probability drops to ≤ 2^{-k}.
- **Why:** Independent runs multiply error probabilities. For Freivalds: P(error after k rounds) ≤ (1/2)^k. At k=20 this is < 10^{-6}.
- **When:** Use whenever a single-round error rate of 1/2 is unacceptable. Rounds are trivially parallelizable.
- **Source:** [research/2026-02-24-frievalds-algorithm.md](../research/2026-02-24-frievalds-algorithm.md)

### The Fingerprinting Framework: Compare Objects via Random Projections
- **What:** To test equality of two large objects Z₁ and Z₂ without direct comparison, compute random "fingerprints" h(Z₁) and h(Z₂). If Z₁ = Z₂ then h(Z₁) = h(Z₂) always; if Z₁ ≠ Z₂ then Pr[h(Z₁) = h(Z₂)] is small (e.g., ≤ d/|S| by Schwartz-Zippel).
- **Why:** Fingerprints are orders of magnitude cheaper to compute and compare than the full objects. Freivalds computes FING(M) = M·r in O(n²) vs O(n³) for full multiplication.
- **When:** Apply whenever exact comparison is too expensive — matrix equality, polynomial identity, set equality, distributed data synchronization (Merkle trees), communication complexity.
- **Source:** [research/2026-02-24-frievalds-algorithm.md](../research/2026-02-24-frievalds-algorithm.md)

### Schwartz-Zippel Lemma: Non-Zero Polynomials Rarely Evaluate to Zero
- **What:** A non-zero multivariate polynomial of degree d, evaluated at a uniformly random point from a set S over a field, equals zero with probability ≤ d/|S|.
- **Why:** This is the mathematical foundation for Freivalds and all polynomial identity testing algorithms. It guarantees that the fingerprinting approach has bounded error.
- **When:** Use this lemma to bound error probability whenever your randomized algorithm reduces a comparison problem to checking whether a polynomial evaluates to zero. Choose |S| >> d to make error negligible.
- **Source:** [research/2026-02-24-frievalds-algorithm.md](../research/2026-02-24-frievalds-algorithm.md)

### Verification vs. Generation Asymmetry
- **What:** Verifying that a result is correct is often drastically cheaper than computing the result in the first place — especially when probabilistic verification is acceptable.
- **Why:** Freivalds verifies A×B = C in O(n²); computing A×B takes O(n^2.373+). This asymmetry (hard to generate, easy to verify) is the same asymmetry underlying NP, cryptographic one-way functions, and interactive proof systems.
- **When:** Whenever computation is expensive and you can tolerate probabilistic assurance, design a cheap randomized verifier instead of recomputing. Especially valuable for auditing outsourced/GPU/cloud computations.
- **Source:** [research/2026-02-24-frievalds-algorithm.md](../research/2026-02-24-frievalds-algorithm.md)

### BPP / RP: Randomized Complexity Classes
- **What:** RP = problems where YES instances are accepted with probability ≥ 1/2, NO instances always rejected. BPP = polynomial time with bounded two-sided error ≤ 1/3. RP ⊆ BPP. Whether BPP = P is open.
- **Why:** Knowing which class an algorithm belongs to guides how to use it. RP algorithms (like Freivalds) give unconditionally reliable NO answers. BPP algorithms (two-sided error) require more rounds to trust either output direction.
- **When:** Classify your randomized algorithms explicitly. Prefer RP over BPP when the problem allows one-sided error.
- **Source:** [research/2026-02-24-frievalds-algorithm.md](../research/2026-02-24-frievalds-algorithm.md)

### Gaussian Vectors Outperform Binary Vectors for Floating-Point Verification
- **What:** The Gaussian variant of Freivalds (GVFA) uses a Gaussian random vector instead of a binary vector. In floating-point arithmetic, GVFA achieves near-zero false positive probability; binary Freivalds has ≤ 1/2 false positive rate per round.
- **Why:** In exact arithmetic, Gaussian vectors produce false positives only on a set of measure zero. Paradoxically, floating-point errors *increase* detection probability for GVFA — making it robust in HPC environments with soft errors.
- **When:** Use GVFA (not classical Freivalds) in numerical linear algebra, scientific computing, or any setting with floating-point arithmetic or hardware-level soft errors.
- **Source:** [research/2026-02-24-frievalds-algorithm.md](../research/2026-02-24-frievalds-algorithm.md), [arXiv:1705.10449](https://arxiv.org/abs/1705.10449)

## Revision History
- 2026-02-24: Initial extraction from Freivalds' algorithm research.
