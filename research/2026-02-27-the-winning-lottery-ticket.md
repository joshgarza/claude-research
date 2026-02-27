---
date: 2026-02-27
topic: The Winning Lottery Ticket
status: complete
tags: [neural-networks, pruning, sparsity, model-compression, deep-learning, MIT]
---

# The Winning Lottery Ticket

## Context

Investigating the claim: "MIT proved you can delete 90% of a neural network while maintaining accuracy." This refers to the Lottery Ticket Hypothesis (LTH), introduced by Jonathan Frankle and Michael Carbin at MIT CSAIL. The original paper, "The Lottery Ticket Hypothesis: Finding Sparse, Trainable Neural Networks" (arXiv:1803.03635), was published at ICLR 2019 where it won Best Paper. Frankle's entire PhD thesis at MIT centered on this hypothesis, and the work has since spawned hundreds of follow-up papers and influenced practical model compression across the industry.

## Findings

### The Core Claim: Fact Check

**Verdict: Verified, with important nuances.**

The claim that you can "delete 90% of a neural network while maintaining accuracy" is substantiated by the original paper's experimental results, but requires qualification:

1. **90%+ pruning was demonstrated on small-to-medium architectures** (LeNet on MNIST, Conv-2/4/6 on CIFAR-10). These are not large-scale production models.
2. **The pruning requires a specific procedure** (iterative magnitude pruning with weight rewinding to initialization), not arbitrary deletion.
3. **The pruned subnetwork must retain its original initialization weights**, not random new ones. The *combination* of mask + original weights is the "winning ticket."
4. **For larger networks (VGG-19, ResNet-18), the story gets more complicated.** The original hypothesis (rewind to initialization) breaks down; you need to rewind to an early training checkpoint instead.
5. **Hardware speedup from 90% sparsity is far less than 10x** in practice. Unstructured sparsity achieves only 1.2-2x GPU speedup; structured sparsity reaches 5-8x.

So the scientific result is real and earned Best Paper at ICLR 2019. The Medium/pop-science framing ("just delete 90%!") oversimplifies both the method and the practical implications.

### The Hypothesis, Formally Stated

> "A randomly-initialized, dense neural network contains a subnetwork that is initialized such that, when trained in isolation, it can match the test accuracy of the original network after training for at most the same number of iterations."

The analogy: training a large neural network is like buying every lottery ticket to guarantee a win. Most tickets (parameters) are losers. The hypothesis says a small fraction are "winning tickets," and if you could identify them upfront, you'd need far fewer parameters.

### The Algorithm: Iterative Magnitude Pruning (IMP)

The method for finding winning tickets:

1. **Initialize** a neural network with random weights theta_0
2. **Train** the network for j iterations, arriving at trained weights theta_j
3. **Prune** the p% lowest-magnitude weights globally, creating a binary mask m
4. **Reset** the surviving weights back to their values at initialization theta_0
5. **Repeat** steps 2-4 iteratively, pruning p^(1/n) percent each round over n rounds

The key insight: it's not just the *structure* (which connections survive) that matters. The *specific initial values* of those connections are critical. When winning ticket structures are given random new initializations, they perform significantly worse. At 21% sparsity on LeNet, a winning ticket reaches minimum validation loss 2.51x faster than the same structure with random reinitialization and is half a percentage point more accurate.

### Specific Experimental Results

From the original paper (Frankle & Carbin, 2019):

**LeNet-300-100 on MNIST (266K parameters):**
- Winning tickets found at ~21% of original size (79% pruned)
- At 21% sparsity: 38% faster early-stopping than unpruned network
- At 13.5% sparsity: test accuracy *improved* by 0.3+ percentage points
- At 3.6% sparsity: performance returns to original network levels

**Conv-2 on CIFAR-10:**
- Best early-stopping at 8.8% of original size: 3.5x faster convergence
- Best accuracy at 4.6% of original: +3.4 percentage point improvement
- Maintains original accuracy when remaining size > 2%

**Conv-4 on CIFAR-10:**
- Best early-stopping at 9.2%: 3.5x faster convergence
- Best accuracy at 11.1%: +3.5 percentage point improvement

**Conv-6 on CIFAR-10:**
- Best early-stopping at 15.1%: 2.5x faster convergence
- Best accuracy at 26.4%: +3.3 percentage point improvement

**VGG-19 on CIFAR-10 (20M parameters):**
- Winning tickets within 1% of original accuracy when remaining size >= 3.5%
- Requires learning rate warmup (10K iterations) at standard learning rates
- With warmup: tickets found at 1.5% of original size

**ResNet-18 on CIFAR-10 (274K parameters):**
- Best tickets at 27.1% sparsity with warmup: 90.5% test accuracy
- Winning tickets found when remaining >= 11.8% with warmup

A striking finding: iterative pruning consistently outperforms one-shot pruning, finding winning tickets that learn faster and reach higher accuracy at smaller sizes. And winning tickets show improved *generalization* with a smaller gap between training and test accuracy.

### The Scaling Problem and Rewinding

The original hypothesis hit a wall at scale. Frankle's own follow-up work (Frankle et al., 2020, ICML) showed:

- **IMP does not find winning tickets in larger networks** (e.g., ResNet-50 on ImageNet) when rewinding all the way to initialization
- **Solution: "late rewinding"** - instead of resetting weights to random initialization theta_0, reset to weights from early in training theta_k (typically 0.1% to 7% into training)
- This is formalized through "linear mode connectivity": lottery ticket subnetworks only reach full accuracy when they are "stable to SGD noise," which happens at initialization for small networks but only after early training for large networks
- With late rewinding, winning tickets are found in ResNet-50 and Inception-v3 on ImageNet

This modified the hypothesis from "subnetworks exist at initialization" to "subnetworks crystallize very early in training." Still remarkable, but a meaningful retreat from the strongest version of the claim.

### Theoretical Proof: The Strong Lottery Ticket Hypothesis

Malach et al. (2020, ICML) provided a theoretical proof going *beyond* the original hypothesis:

> For any target network with bounded weights, a sufficiently over-parameterized neural network with *purely random weights* contains a subnetwork that approximates the target network without any training whatsoever.

The catch: "sufficiently over-parameterized" means O(log(d * l)) wider and 2x deeper than the target, where d is width and l is depth. This proves that pruning alone, without any gradient-based optimization, can in principle achieve arbitrary function approximation. The result is more theoretical than practical (the required overparameterization is large), but it validates the intuition that large random networks contain useful structure.

### Historical Context: Pruning Before LTH

Network pruning long predates the lottery ticket hypothesis:

- **1989-1993**: LeCun's "Optimal Brain Damage" (OBD) and Hassibi's "Optimal Brain Surgeon" (OBS) used second-order Taylor expansion to estimate parameter importance
- **2015**: Han et al. reintroduced simple magnitude-based pruning in "Deep Compression," achieving 9-13x compression on AlexNet/VGG-16 with no accuracy loss
- **2017**: Han et al. combined pruning + quantization + Huffman coding for 35-49x compression

What LTH added was the insight about *trainability*: it's not just that you can prune a trained network (that was known), but that the pruned structure *with its original initialization* can be trained from scratch to match the full network. This shifts the framing from "compression after training" to "the network was always unnecessarily large."

### Extensions Beyond Vision

**BERT and Language Models (Chen et al., 2020, NeurIPS):**
- Winning tickets found at 40-90% sparsity in BERT on GLUE/SQuAD tasks
- Tickets found at pre-trained initialization (not random init)
- Interesting twist: with *structured* pruning, "good," "random," and "bad" subnetworks all perform similarly for most GLUE tasks, suggesting BERT is highly redundant

**Graph Neural Networks:**
- Graph Lottery Tickets (GLT) prune both adjacency matrices and model weights simultaneously
- Addresses over-smoothing in deep GNNs through layer-adaptive pruning

**Generative Models:**
- Diffusion models support 90-99% sparsity without performance loss
- Variable sparsity across layers in the reverse diffusion process

**Reinforcement Learning:**
- RL agents require more degrees of freedom than supervised learning
- Feed-forward networks from behavioral cloning prune to higher sparsity than RL-trained networks

### LLM Pruning: The Modern Frontier

The lottery ticket hypothesis inspired, but doesn't directly apply to, modern LLM pruning:

**SparseGPT (Frantar & Alistarh, 2023):** One-shot pruning to 50%+ sparsity on GPT-family models using a layer-wise reconstruction approach inspired by Optimal Brain Surgeon. No retraining required. Achieves minimal perplexity loss at 50% unstructured sparsity on models up to 175B parameters.

**Wanda (Sun et al., 2024, ICLR):** Prunes by multiplying weight magnitudes by corresponding input activations. No retraining or weight update needed. Matches SparseGPT at 50% unstructured sparsity with far less computation. At 70% sparsity on LLaMA models, preserves perplexity scores.

These methods are *post-training* and don't use the full IMP+rewinding procedure. They build on the same intuition (most parameters are dispensable) but use different techniques suited to the scale of modern LLMs, where iterative train-prune-rewind cycles would be prohibitively expensive.

### Hardware Reality: The Sparsity-Speed Gap

The biggest gap between the LTH's promise and real-world impact:

**Unstructured sparsity** (what IMP produces): Individual weights scattered across matrices are zeroed. GPUs can't exploit this efficiently. Actual speedup: 1.2-2x despite 90%+ zeros. Current GPU architectures are optimized for dense matrix multiplication.

**NVIDIA 2:4 structured sparsity** (A100+ GPUs): Two of every four contiguous weights are zero. Sparse Tensor Cores process only non-zero values, achieving ~2x throughput. Built into hardware since the Ampere architecture (2020). Supported via cuSPARSELt library. Limitation: only 50% sparsity.

**Structured pruning** (channels/filters/heads): Remove entire computational units. Maps cleanly to hardware. Achieves 5-8x speedup. But typically can't reach the extreme sparsity levels (90%+) that unstructured IMP achieves without accuracy loss.

This hardware mismatch means the LTH's most dramatic results (95%+ sparsity with accuracy) don't translate to proportional inference speedups on current hardware. The field is converging on structured or semi-structured approaches that sacrifice maximal sparsity for actual runtime gains.

### Jonathan Frankle's Trajectory

Frankle's career arc illustrates the impact of the work:

- PhD student at MIT CSAIL under Michael Carbin
- Initial paper rejected at NeurIPS 2018 due to concerns about cherry-picked hyperparameters
- Added 30 pages of hyperparameter sweeps; paper accepted as **Best Paper at ICLR 2019**
- PhD thesis (2023) centered entirely on the lottery ticket hypothesis and its extensions
- Won AAAI/ACM SIGAI Doctoral Dissertation Award
- Co-founded **MosaicML** with Carbin in 2021 (CSAIL spinout focused on efficient training)
- MosaicML acquired by **Databricks for $1.3 billion** in 2023
- Currently **Chief AI Scientist at Databricks**, leading the research team

In his NeurIPS 2019 retrospective, Frankle reflected honestly on the work: the initial experiments ran on a laptop and old K80 GPUs, demonstrating that "you don't need to work at a major tech company to do productive empirical research." He also noted the irony that peer review itself is a lottery: "a nearly identical paper was rejected at one top venue but won best paper at another."

### Industry Adoption and Future Outlook

**Current state (2026):**
- Pruning is standard practice in edge/mobile ML deployment
- NVIDIA's hardware-level sparsity support validates the commercial relevance
- A 2024 Forrester report projects 70% of production AI models will incorporate sparsity by 2027
- Edge AI growth at 25% CAGR drives demand for compressed models
- Early-Bird tickets (identifying winning tickets partway through training) reduce training costs by up to 38%

**Convergent trend:** The field has moved from "find the winning ticket" toward practical compression pipelines that combine pruning with quantization, knowledge distillation, and architecture search. The lottery ticket hypothesis provided the conceptual breakthrough; production systems use pragmatic approximations.

## Open Questions

1. **Can we identify winning tickets without training the full network first?** The original method requires full training then pruning, making the discovery process as expensive as standard training. Early-Bird tickets and one-shot methods reduce but don't eliminate this cost.
2. **Why do specific initializations matter?** The theoretical understanding of *why* certain initial weight configurations are "winners" remains incomplete. The sign of initial weights (not just magnitude) appears crucial (Zhou et al., 2019).
3. **Does the hypothesis hold for foundation models?** LTH was validated on CIFAR-10-scale models. Modern LLMs use different pruning approaches (SparseGPT, Wanda) that don't follow the IMP+rewinding recipe. Whether true "winning tickets" exist in 100B+ parameter models from initialization is unresolved.
4. **Hardware co-design:** Can we build hardware that efficiently exploits unstructured sparsity, unlocking the full potential of 90%+ sparse networks? Current GPU architectures require structured sparsity patterns.
5. **Lottery tickets in other domains:** Active research on graph neural networks, diffusion models, and RL agents, but each domain exhibits different sparsity behaviors and limits.

## Extracted Principles

No new principles file created. Key takeaways:

- **The 90% claim is real but contextualized.** Demonstrated on small-to-medium vision models (LeNet, Conv-2/4/6, VGG-19) with specific methodology (IMP + weight rewinding). Does not trivially extend to arbitrary architectures or scales.
- **Initialization matters more than structure.** The winning ticket's power comes from the combination of which connections survive AND their specific initial values. Random reinitialization of the same structure performs significantly worse.
- **The hypothesis weakens at scale.** For large networks, you must rewind to early training (not initialization), meaning the "lottery" is partially drawn during early training, not entirely at random init.
- **Practical sparsity requires hardware awareness.** Unstructured 90% sparsity yields minimal GPU speedup. Production systems use structured or semi-structured sparsity (NVIDIA 2:4) at lower sparsity ratios but with real runtime gains.
- **The conceptual impact exceeds the direct practical impact.** LTH changed how the field thinks about overparameterization and inspired practical compression methods (SparseGPT, Wanda) that use different techniques at LLM scale.
