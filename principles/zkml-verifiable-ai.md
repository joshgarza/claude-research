# zkML and Verifiable AI

## Summary

Zero-knowledge machine learning (zkML) applies ZKP cryptographic primitives to neural network computation, enabling verification that an AI model ran correctly on specific inputs without revealing the model weights, inputs, or intermediate computation. For LLMs specifically, the field has crossed from theoretical demonstration to early production in 2025 (GPT-2 proved end-to-end, 13B models in ~15 minutes), but real-time proving for modern large models remains years away. The practical value today is primarily in governance, compliance, and high-value asynchronous verification, not in real-time latency-sensitive applications.

## Principles

### ZKP-for-LLMs: Integrity vs. Privacy are Different Goals

- **What:** ZKPs prove *correctness* of computation (integrity). Homomorphic Encryption (HE) allows computation on *encrypted inputs* (privacy). Secure Multi-Party Computation (MPC) enables *distributed computation* across parties. These solve distinct problems.
- **Why:** Using ZKPs when the goal is hiding user input from the model provider is the wrong tool — that requires HE or MPC. ZKPs shine when the goal is proving to a third party that a specific computation happened correctly.
- **When:** Choose ZKP when: (a) the output's authenticity needs to be proven to someone who doesn't trust the prover; (b) model weights or training data need to stay private from the verifier; (c) auditability or regulatory compliance drives the requirement. Choose HE for client-side input privacy. Choose MPC for multi-organizational collaborative training.
- **Source:** [research/2026-02-28-research-zero-knowledge-proofs-in-regards-to-large-language-models.md]

### Understand the Current Overhead Reality Before Committing

- **What:** ZKP proving for LLMs adds 10,000-100,000x overhead vs. plain inference as of early 2026. A 13B model proof takes ~15 minutes; GPT-2 full proof is the production ceiling.
- **Why:** Misaligned expectations cause failed zkML projects. The field improves rapidly (~100x improvement per 2-3 years) but is not yet viable for real-time interactive applications at production scale.
- **When:** Use zkML today for: asynchronous batch auditing; rare high-value decisions (loan approvals, medical diagnoses); governance checkpoints; model marketplace authenticity receipts. Do NOT use for: interactive chat; real-time inference pipelines; sub-second latency requirements.
- **Source:** [research/2026-02-28-research-zero-knowledge-proofs-in-regards-to-large-language-models.md]

### Quantization Fidelity Must Be Validated for High-Stakes Applications

- **What:** ZKP circuits operate over finite fields, not floating-point. ML models must be quantized to integer arithmetic before circuit compilation. This changes model behavior.
- **Why:** A model that "passes" a zkML integrity proof may not behave identically to the certified floating-point version. For regulated applications (FDA-cleared diagnostics, financial models), the quantized version may not be equivalent to the certified original.
- **When:** Before deploying zkML for any regulated use case, benchmark quantized model outputs against the original on representative inputs. Accept no more than X% output divergence (define X based on the domain's error tolerance). The proof verifies the quantized computation was correct, not that it matches the original model exactly.
- **Source:** [research/2026-02-28-research-zero-knowledge-proofs-in-regards-to-large-language-models.md]

### Start with Governance Use Cases, Not Real-Time Inference

- **What:** The highest-ROI zkML applications today are governance, compliance, and audit — not performance-critical inference paths.
- **Why:** These use cases tolerate minutes-long proof generation times, match the asynchronous nature of regulatory auditing, and have high enough value per proof to justify the compute cost.
- **When:** Prioritize: (1) model provenance receipts (prove this API served GPT-X, not a cheaper substitute); (2) training data attestation (prove model was trained on licensed data); (3) compliance auditing (prove inference followed a certified protocol); (4) right-to-erasure verification (ZKP of unlearning). Defer real-time verifiable streaming inference until proving overhead drops below 100x.
- **Source:** [research/2026-02-28-research-zero-knowledge-proofs-in-regards-to-large-language-models.md]

### Use the Optimistic Pattern for Production zkML Deployment

- **What:** Instead of proving every inference (high overhead), only generate proofs when challenged or for sampled high-value interactions. This mirrors Optimistic Rollup design in blockchains.
- **Why:** Always-prove zkML is economically infeasible for interactive applications at current overhead levels. Optimistic zkML maintains verifiability for what matters while reducing average-case cost dramatically.
- **When:** Apply optimistic zkML when: (a) most inferences are routine with low dispute likelihood; (b) the cost of proving all inferences exceeds the risk of unverified inferences; (c) a challenge/dispute resolution mechanism can be defined. Requires: off-chain proof generation capability; defined challenge window; economic stake for incorrect claims.
- **Source:** [research/2026-02-28-research-zero-knowledge-proofs-in-regards-to-large-language-models.md]

### Non-Arithmetic Operations are the Proving Bottleneck

- **What:** ML operations that are computationally trivial (softmax, GELU, LayerNorm, ReLU) become disproportionately expensive in ZKP circuits, requiring lookup tables or polynomial approximations.
- **Why:** ZKP circuit efficiency is determined by constraint count, not FLOP count. Non-arithmetic functions require thousands of constraints per operation. A single softmax across a 4096-wide attention head can dominate total circuit size.
- **When:** When evaluating zkML feasibility for a model, profile the circuit constraint cost of activation functions specifically. Architecture choices that reduce softmax calls (e.g., linear attention, ReLU transformers) can dramatically reduce proving overhead. The zkLLM tlookup protocol and EZKL's lookup arguments represent the state of the art for handling these operations efficiently.
- **Source:** [research/2026-02-28-research-zero-knowledge-proofs-in-regards-to-large-language-models.md]

### LLMs Can Write ZKP Circuit Code — With Structured Augmentation

- **What:** Raw LLM prompting for ZKP circuit code (Circom, Noir) produces poor results (~20-30% accuracy on algebraic primitives). With structured augmentation (constraint sketching + retrieval + iterative refinement), accuracy jumps to 87-97%.
- **Why:** ZKP programming requires a paradigm shift from imperative computation to declarative constraint verification. LLMs have good surface-level syntax knowledge but poor constraint reasoning without external scaffolding.
- **When:** Use the ZK-Coder approach when building zkML systems: (1) formalize requirements as constraint sketches first; (2) use a curated verified-implementation knowledge base for retrieval; (3) implement a generate-compile-test-repair loop that validates both compiler correctness and semantic correctness (valid witnesses pass, invalid ones fail). Expect generated circuits to be correct but not optimally efficient — manual optimization of gate count is still required for production provers.
- **Source:** [research/2026-02-28-research-zero-knowledge-proofs-in-regards-to-large-language-models.md]

### End-to-End Pipeline Verification Has Two Critical Gaps

- **What:** Full cryptographic verifiability of the ML pipeline (data → training → inference) is the goal but is not yet achievable. Two gaps prevent it: (1) data preprocessing lacks ZKP coverage; (2) training proofs and inference proofs use incompatible cryptographic systems.
- **Why:** The end-to-end integrity claim requires a chain of proofs where each step commits to the outputs consumed by the next step. Without compatible proof systems across training (ZKPoT) and inference (ZKPoI), a model could pass individual component audits while being substituted at the handoff.
- **When:** When designing verifiable AI systems, explicitly decide what the chain of custody covers. State clearly whether the proof covers: (a) only inference from a committed model; (b) training on a committed dataset; or (c) both. Do not claim end-to-end verifiability unless both the training-inference commitment link and the data processing step have cryptographic coverage.
- **Source:** [research/2026-02-28-research-zero-knowledge-proofs-in-regards-to-large-language-models.md]

## Revision History
- 2026-02-28: Initial extraction from research/2026-02-28-research-zero-knowledge-proofs-in-regards-to-large-language-models.md
