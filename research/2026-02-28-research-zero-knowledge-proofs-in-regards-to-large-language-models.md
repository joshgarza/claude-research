---
date: 2026-02-28
topic: Zero knowledge proofs in regards to large language models
status: complete
tags: [cryptography, zkp, zkml, llm, privacy, verifiable-ai, governance]
---

# Zero Knowledge Proofs in Regards to Large Language Models

## Context

Zero-knowledge proofs (ZKPs) have moved from an esoteric cryptographic primitive to an active frontier of AI infrastructure research. As LLMs are deployed in high-stakes domains — healthcare diagnostics, financial decision-making, autonomous agents, regulated content moderation — the question of *verifiability* becomes critical: how can users or regulators confirm that a specific model ran on specific data and produced the claimed output, without revealing proprietary weights or sensitive inputs?

This research investigates the intersection of ZKPs and LLMs across two primary directions: (1) applying ZKPs *to* LLMs to enable verifiable and private inference, and (2) using LLMs *to generate* ZKP circuit code. It covers the current state of zkML (zero-knowledge machine learning) frameworks, academic breakthroughs, practical limitations, governance applications, and the 2026 outlook.

## Findings

### 1. ZKP Fundamentals in the ML Context

A zero-knowledge proof allows a *prover* to convince a *verifier* that a computation was performed correctly, without revealing any private information about the inputs or the computation itself. In ML terms: a model provider can prove that inference was run using model M on input X and produced output Y — without revealing M (proprietary weights), X (sensitive user data), or any intermediate state.

The three guarantees ZKPs provide in ML contexts:
- **Completeness**: A correct computation always produces a valid proof.
- **Soundness**: An incorrect computation cannot produce a valid proof (except with negligible probability).
- **Zero-knowledge**: The verifier learns nothing beyond the validity of the statement.

The two dominant ZKP proof systems in use for ML:
- **zk-SNARKs** (Succinct Non-interactive Arguments of Knowledge): Very small proofs, fast verification, but typically require a trusted setup. Used by EZKL (Halo2), zkLLM.
- **zk-STARKs** (Scalable Transparent ARguments of Knowledge): Larger proofs, no trusted setup, quantum-resistant. Used by Giza/Orion (StarkWare's STWO prover).

### 2. The Core Challenge: ML Arithmetic vs. ZKP Circuits

Neural networks operate in floating-point arithmetic. ZKP circuits operate over finite fields (modular integers). Bridging this gap is the central technical challenge of zkML.

**Quantization**: ML models must be quantized to fixed-point integer representation before circuit compilation. This introduces precision loss with no universal solution. Common approaches use 8-bit integers, which changes model behavior in ways that may not be acceptable for all applications.

**Non-arithmetic operations**: Operations that are "free" in standard ML are expensive in ZKP circuits because they require polynomial approximations or lookup tables:
- **ReLU**: Manageable but requires range checks
- **Softmax and GELU**: The "true pain" of transformer circuits — they require expensive lookup arguments
- **LayerNorm**: Introduces division, which is costly in finite field arithmetic
- **Rotary Position Embeddings (RoPE)**: Trigonometric operations requiring multi-table lookups

**Operator coverage gap**: ONNX (the standard ML model format) supports 120+ operators. Most zkML frameworks support approximately 50. Critical gaps include dynamic control flow, custom layers, and many 2024-era transformer innovations.

**Memory requirements**: Proof generation for large models is extremely memory-intensive. Some configurations require 148GB of RAM for a single inference proof. This limits deployment to specialized hardware.

### 3. Core Academic Contribution: zkLLM (CCS 2024)

The landmark paper in this space is **zkLLM** by Haochen Sun, accepted at ACM CCS 2024 — the first specialized zero-knowledge proof system tailored specifically for large language models. [Source: [arxiv.org/abs/2404.16109](https://arxiv.org/abs/2404.16109), [dl.acm.org/doi/10.1145/3658644.3670334](https://dl.acm.org/doi/10.1145/3658644.3670334)]

**Key innovations:**
- **tlookup**: A parallelized lookup argument for non-arithmetic tensor operations. The protocol handles the softmax, attention, and activation functions that typically form bottlenecks in generic ZKP systems, with "no asymptotic overhead."
- **zkAttn**: A specialized ZKP protocol for the attention mechanism, carefully balancing proving time, memory usage, and numerical accuracy.
- **Parallelized CUDA implementation**: Proofs are generated using fully parallelized GPU code.

**Performance benchmarks:**
- 13 billion parameter model: complete inference proof generated in under 15 minutes
- Proof size: less than 200 kB regardless of model size
- Hardware: standard consumer GPU setup

This was a major milestone — for the first time, verifiable inference was demonstrated at "real" model scale, not just toy models or CNNs.

### 4. Production Milestone: DeepProve-1 (Lagrange Labs)

In 2025, Lagrange Labs released **DeepProve-1**, the first production-ready zkML system to prove a complete GPT-2 inference end-to-end. [Source: [lagrange.dev/blog/deepprove-1](https://lagrange.dev/blog/deepprove-1)]

**Technical approach:**
- Supports arbitrary graph-structured computation (not just sequential layers), enabling multi-head attention, residual connections, and parallel branches
- Implements transformer-specific operations: softmax via ConcatMatMul, LayerNorm, GELU, multi-head attention
- Ingests models in GGUF format (widely adopted for LLM export/deployment)
- Includes an autoregressive inference engine that manages token-by-token generation while preserving proof integrity

**Significance:** GPT-2 is a small model by modern standards (~117M to 1.5B parameters), but the same primitive operations appear in Llama, Mistral, Falcon, and all other modern transformer architectures. DeepProve-1 established that full transformer inference is provable in practice, not just in theory. Roadmap targets Llama support as the next milestone.

**zkPyTorch and ZKTorch** (other 2025 frameworks) have pushed further: zkPyTorch demonstrates Llama-3 in 150 seconds per token and VGG-16 in 2.2 seconds. ZKTorch (a universal compiler with proof accumulation) targets GPT-J (6B params) in 20 minutes. [Source: [blog.icme.io/the-definitive-guide-to-zkml-2025/](https://blog.icme.io/the-definitive-guide-to-zkml-2025/)]

### 5. ZK-DeepSeek: Proving at 671B Scale

The paper "Zero-Knowledge Proof Based Verifiable Inference of Models" (arXiv:2511.19902) presents **ZK-DeepSeek**, a SNARK-verifiable instantiation of DeepSeek-V3 (671 billion parameters). [Source: [arxiv.org/abs/2511.19902](https://arxiv.org/abs/2511.19902)]

**Technical approach:**
- Decomposes inference layer-by-layer into verifiable components: GeMM (general matrix multiplication), RMSNorm, RoPE, Softmax, SiLU
- Handles oversized matrices via recursive subdivision
- Uses integer-based arithmetic (Int64/Int32) for finite-field compatibility
- Constant-size proofs and constant verification times (~320-380ms) regardless of model scale

**Benchmark results:**
- Embedding verification: 4,823 seconds proving time
- Single matrix multiplication (wkv_a1): 204,138 seconds (~57 hours)
- All with ~32-36KB constant proof size and ~350ms verification time

**Assessment:** ZK-DeepSeek is a significant theoretical result demonstrating the *possibility* of proving 671B parameter inference, but the current proving times are deeply impractical for any real-world deployment. The result demonstrates the path, not the destination.

### 6. Verifiable Fine-Tuning: VeriLoRA

**VeriLoRA** (arXiv:2508.21393) extends ZKP coverage to the fine-tuning process itself, specifically Low-Rank Adaptation (LoRA). [Source: [arxiv.org/abs/2508.21393](https://arxiv.org/abs/2508.21393)]

LoRA is the dominant parameter-efficient fine-tuning method for LLMs. VeriLoRA provides end-to-end cryptographic verification of:
- Forward propagation
- Backward propagation (gradient computation)
- Parameter update steps

Using lookup arguments, sumcheck protocols, and polynomial commitments to handle both arithmetic and non-arithmetic operations. Validated on LLaMA up to 13B parameters.

**Why this matters:** Fine-tuning is where models are customized for sensitive domains. A healthcare company fine-tuning on patient records, or a law firm on confidential case files, could use VeriLoRA to prove the fine-tuning followed a specific procedure without revealing the training data itself.

### 7. The zkML Framework Ecosystem (2025-2026)

| Framework | Backend | Key Strength | Scale |
|-----------|---------|-------------|-------|
| **EZKL** | Halo2 (zk-SNARK) | ONNX→circuit automation; 65x faster than RISC Zero | Vision models, small transformers |
| **Lagrange DeepProve** | Custom SNARK | First GPT-2 production proof; GGUF input | GPT-2, roadmap to Llama |
| **zkPyTorch** | Custom | Transformer breakthrough; PyTorch integration | Llama-3 feasibility |
| **ZKTorch** | Universal compiler | Proof accumulation; no architectural limits | GPT-J (6B params) |
| **Giza/Orion** | STWO (zk-STARK) | Starknet integration; no trusted setup | On-chain ML, smaller models |
| **Jolt Atlas** | Lookup-native zkVM | Fast for memory-intensive tasks | ML workloads, Ethereum integration |

[Sources: [blog.icme.io/the-definitive-guide-to-zkml-2025/](https://blog.icme.io/the-definitive-guide-to-zkml-2025/), [kudelskisecurity.com/modern-ciso-blog/zkml-verifiable-machine-learning-using-zero-knowledge-proof](https://kudelskisecurity.com/modern-ciso-blog/zkml-verifiable-machine-learning-using-zero-knowledge-proof)]

**2025 universal developments across all frameworks:**
- GPU (CUDA) support is now standard or near-standard
- Proof costs have dropped to approximately $0.02 for certain operation classes
- Multi-machine distributed proving is being added via recursive proofs and aggregation

### 8. ZKP vs. Homomorphic Encryption vs. MPC for Private LLM Inference

ZKPs are one of three major cryptographic approaches to private ML. Understanding the differences is essential for selecting the right tool. [Source: [blog.lambdaclass.com/fully-homomorphic-encryption-zero-knowledge-proofs-and-multiparty-computation/](https://blog.lambdaclass.com/fully-homomorphic-encryption-zero-knowledge-proofs-and-multiparty-computation/)]

**Zero-Knowledge Proofs:**
- **Purpose**: Integrity verification — prove a computation was done correctly
- **What stays private**: Can protect inputs, weights, or both
- **Overhead**: High for generation, near-zero for verification
- **Best for**: Verifiable inference, auditability, governance compliance

**Fully Homomorphic Encryption (FHE):**
- **Purpose**: Private computation — run inference on encrypted inputs without the server seeing plaintext
- **What stays private**: User inputs are hidden from the model provider
- **Overhead**: 10,000x+ slower than plaintext computation; impractical for large LLMs today
- **Best for**: Scenarios where the client cannot share raw data with any server

**Secure Multi-Party Computation (MPC):**
- **Purpose**: Distributed computation — multiple parties compute a function without revealing their individual inputs
- **What stays private**: Each party's inputs; useful when ownership is distributed
- **Overhead**: Typically more efficient than FHE; requires multiple rounds of communication
- **Best for**: Collaborative ML across organizations; federated training without revealing private datasets

**The composability insight:** These approaches are complementary. FHE + ZKP provides both computation privacy and integrity verification. MPC + ZKP enables multi-party scenarios with verifiable correctness. The 2025 research direction is explicitly toward multi-layer hybrid frameworks.

### 9. End-to-End AI Pipeline Verifiability

The most ambitious direction in the space is cryptographic verifiability of the *entire* AI pipeline — not just inference, but training, evaluation, and data provenance. A 2025 framework paper (arXiv:2503.22573) maps this as a six-step pipeline: [Source: [arxiv.org/html/2503.22573v1](https://arxiv.org/html/2503.22573v1)]

1. **Raw Dataset Verification**: Digital signatures + ZK Proofs of Fairness (ZKPoFs) to attest data origin and bias properties
2. **Data Extraction & Analysis**: Currently the biggest gap — lacks verifiable ZKP coverage
3. **Model Training**: ZK Proofs of Training (ZKPoTs) — prove training used specified datasets and algorithms
4. **Model Evaluation**: Aggregate performance metric verification while maintaining data privacy
5. **Model Inference**: ZK Proofs of Inference (ZKPoIs) — the most mature component
6. **Machine Unlearning**: ZK Proofs of Unlearning (ZKPoUs) — cryptographic compliance with right-to-erasure requests

**Two critical gaps preventing end-to-end verifiability:**
1. **Data processing gap**: Between raw data and training-ready inputs, current ZKP solutions are immature
2. **Training-inference gap**: ZKPoTs and ZKPoIs use incompatible proof systems, preventing cryptographic linkage

**ZKAudit** is an early framework that proves model training occurred via stochastic gradient descent on a committed dataset. It supports real-world models (MobileNet v2, DLRM-style recommenders) and enables audits including censorship detection, copyright verification, and counterfactual analysis.

### 10. AI Governance Use Cases

The practical applications of ZKP for LLMs are primarily in the governance domain:

**Model authenticity verification**: API providers can prove they are running GPT-4 rather than a cheaper substitute. Model marketplaces can attach cryptographic receipts to responses.

**Regulatory compliance proofs**: Healthcare providers can prove a diagnostic AI ran the FDA-approved model on specific patient data, without exposing the patient record or the model. Banks can audit fraud detection systems without revealing transaction details.

**AI-generated content authentication**: ZKPs can prove that text or other content originated from a specific model, supporting media integrity verification and academic integrity systems.

**Trustless agent networks**: Multi-agent systems operating across trust boundaries (e.g., DeFi protocols, agent-to-agent payment networks) can require cryptographic proof of computation as a precondition for action. Emerging standards like x402 and ERC-8004 enable agent-to-agent payments requiring proof of work completion.

**Training data provenance**: Prove that a model was trained on a specific dataset, or that a dataset does *not* include certain content, without revealing the dataset itself. Relevant for copyright compliance, GDPR right-to-erasure verification, and claims of bias auditing.

[Sources: [cloudsecurityalliance.org/blog/2024/09/20/leveraging-zero-knowledge-proofs-in-machine-learning-and-llms-enhancing-privacy-and-security](https://cloudsecurityalliance.org/blog/2024/09/20/leveraging-zero-knowledge-proofs-in-machine-learning-and-llms-enhancing-privacy-and-security), [calibraint.com/blog/zero-knowledge-proof-ai-2026](https://www.calibraint.com/blog/zero-knowledge-proof-ai-2026)]

### 11. The Reverse Direction: LLMs Generating ZKP Code

The intersection runs both ways: LLMs are also being used to *write* zero-knowledge proof circuit code, dramatically lowering the barrier to zkML adoption.

**ZK-Coder** (arXiv:2509.11708) is the first agentic framework for LLM-assisted ZKP code generation. [Source: [arxiv.org/html/2509.11708](https://arxiv.org/html/2509.11708)]

**The core problem**: ZKP programming requires a paradigm shift from imperative "tell the computer what to do" to declarative "tell the circuit what constraints must hold." This is fundamentally different from standard programming and LLMs struggle with raw prompting approaches.

**ZK-Coder's three-stage pipeline:**
1. **Constraint Sketching**: LLMs formalize requirements using ZKSL (ZK Sketch Language), a Python-embedded DSL abstracting ZKP constraint systems
2. **Sketch-Guided Retrieval**: Extracts algebraic primitives and retrieves verified implementations from a curated knowledge base
3. **Interactive Refinement**: A generate-compile-test-repair loop that validates both compiler correctness and semantic correctness (do valid witnesses pass? do invalid ones fail?)

**ZK-Eval benchmark results (on GPT-o3):**
- Circom: from 20.29% → 87.85% accuracy with ZK-Coder
- Noir: from 28.38% → 97.79% accuracy with ZK-Coder
- Raw LLM performance on syntax/language questions: ~87% (surface understanding is fine)
- Raw LLM performance on algebraic primitive implementation: 20-52% (constraint reasoning breaks down without augmentation)

**Limitation**: Generated circuits are typically not optimized for prover performance or gate count — they may be correct but computationally inefficient.

### 12. Current State Assessment (February 2026)

**What works today:**
- Verifiable inference for models up to ~1.5B parameters in near-practical time
- GPT-2 full inference proofs in production (DeepProve-1)
- 13B model proofs in under 15 minutes (zkLLM)
- CNN and vision model proofs in seconds (EZKL on smaller architectures)
- LoRA fine-tuning verification (VeriLoRA)
- Training data commitment and audit schemes (ZKAudit)
- LLM-assisted ZKP circuit code generation (ZK-Coder)

**What does not work yet:**
- Real-time inference proving for modern LLMs (GPT-4, Llama 3 70B+)
- Full training verification for large-scale models
- End-to-end pipeline linkage (training proof to inference proof)
- Sub-100ms proving for any model with >100M parameters
- Proof generation without specialized hardware (148GB RAM requirements for some operations)

**Overhead context:** The best current systems still add roughly 10,000-100,000x overhead vs. plain inference. The trend is rapidly improving (down from ~1,000,000x in 2022), but real-time verifiable inference for production-scale LLMs remains 2-4 years away.

**The "Optimistic zkML" emerging pattern:** Similar to Optimistic Rollups in blockchain, researchers are exploring a model where proofs are only generated when challenged rather than for every inference. This dramatically reduces overhead for the common case while preserving verifiability when it matters.

### 13. 2026 Roadmap and Predictions

Based on the current trajectory:
- **GPU-native proving**: 5-10x speedup through algorithm redesign for GPU primitives
- **Multi-machine distributed proof generation**: Recursive proofs and aggregation across clusters
- **Field arithmetic improvements**: Mersenne-31 fields and lattice-based schemes offer 10x improvements
- **Folding schemes**: Proof accumulation reduces large proof sizes dramatically (ResNet-50 proofs: from 1.27GB to <100KB)
- **Sub-second proving**: Simple models (CNNs, small transformers) will achieve reactive agent speeds
- **Transformer primitive optimization**: Softmax, GELU, and attention become standardized circuit components

[Source: [blog.icme.io/the-definitive-guide-to-zkml-2025/](https://blog.icme.io/the-definitive-guide-to-zkml-2025/), [academy.extropy.io/pages/articles/zkml-singularity.html](https://academy.extropy.io/pages/articles/zkml-singularity.html)]

## Open Questions

1. **Economic viability**: At what point does the cost of proof generation become acceptable? The $0.02/operation metric is promising but token-by-token LLM generation multiplies this per token. What is the realistic cost floor?

2. **Training verification at scale**: Can ZKPoTs (proofs of training) ever be practical for models trained on trillions of tokens? Current research only covers small models. The training compute exceeds inference by orders of magnitude.

3. **Proof system standardization**: Multiple incompatible proof systems (Halo2, STWO, Spartan, Jolt) are in use. Will one dominate, or will the field settle on an abstraction layer? Incompatible systems prevent end-to-end pipeline chaining.

4. **Quantization fidelity**: Fixed-point quantization required for ZKP circuits changes model behavior. For high-stakes applications (medical, legal), is the resulting model still compliant with the certification the proof is supposed to verify?

5. **Regulatory frameworks**: Are there emerging regulations requiring verifiable AI inference proofs? EU AI Act, FDA AI/ML guidance, and financial regulations are moving toward auditability requirements but have not yet mandated specific cryptographic approaches.

6. **Optimistic zkML tradeoffs**: The challenge vs. always-prove model shifts economic incentives but requires a robust challenge mechanism. Who determines what warrants a challenge? How are disputes resolved?

7. **Hardware centralization risk**: As ZKP proving becomes commercially important, will specialized ASICs (FPGAs, custom silicon) centralize proof generation to a few large players, defeating the democratization goal?

## Extracted Principles

New principles file created at `principles/zkml-verifiable-ai.md`:
- ZKP for LLMs: scope and current limits (inference is possible, training is not)
- Tool selection: ZKP for integrity vs. HE for input privacy vs. MPC for multi-party
- Practical overhead calibration (know the current 10,000-100,000x overhead reality)
- Governance-first framing (start with high-value, low-frequency use cases)
- Optimistic ZKP pattern for production deployment
