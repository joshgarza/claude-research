# VLM Basics

## Summary

Vision-Language Models (VLMs) combine a visual encoder, a projection layer, and an LLM backbone to reason jointly over images and text. CLIP and its descendants (SigLIP) are the foundational visual encoders that almost all generative VLMs build on. Understanding the three-component architecture and multi-stage training process is essential for choosing the right model, fine-tuning effectively, and avoiding common production pitfalls.

## Principles

### CLIP Is the Foundation, Not an Endpoint

- **What:** CLIP creates a shared embedding space between images and text via contrastive learning on 400M image-text pairs. Almost all generative VLMs use a pretrained CLIP (or SigLIP) vision encoder as their visual backbone — they don't train vision understanding from scratch.
- **Why:** CLIP's representations are already language-aligned, which dramatically simplifies the projector alignment stage. Training vision from scratch requires orders of magnitude more data.
- **When:** Always check whether a task needs just CLIP-level retrieval (image-text similarity) vs. full VLM generation (describing, reasoning about images). Use the cheapest sufficient layer.
- **Source:** `research/2026-02-24-vlm-basics.md`

---

### The Three-Component Architecture Is Standard

- **What:** Modern generative VLMs follow: Vision Encoder (ViT/CLIP) → Projection Layer (2-layer MLP most common) → LLM Backbone (decoder-only transformer). The projection layer converts ViT vectors (~768d) into LLM embedding space (~4096d).
- **Why:** Each component can be pretrained independently and composed. The projector is the "adapter" that makes a pretrained vision model and a pretrained LLM work together.
- **When:** When evaluating or integrating VLMs, identify which component is being swapped or fine-tuned. Most tasks only require fine-tuning the projector + LLM, not the vision encoder.
- **Source:** `research/2026-02-24-vlm-basics.md`

---

### Freeze Vision Encoder by Default

- **What:** In VLM training and fine-tuning, freeze the CLIP/SigLIP vision encoder. Unfreeze only when your task requires novel visual concepts clearly outside CLIP's pretraining distribution.
- **Why:** The vision encoder contains years of pretraining on 400M+ image-text pairs. Unfreezing it with a small fine-tuning dataset risks catastrophic forgetting. For most tasks (documents, charts, photos), CLIP's visual representations are already sufficient.
- **When:** Freeze during Stage 1 (projector pre-alignment) and usually Stage 2 (SFT). Unfreeze for specialized domains: medical imaging, satellite imagery, specific industrial defect patterns.
- **Source:** `research/2026-02-24-vlm-basics.md`

---

### Three-Stage Training Is the Established Recipe

- **What:** Standard VLM training: (1) pretrain vision encoder separately (CLIP), (2) train projector only while freezing both encoder and LLM (~600K image-caption pairs), (3) unfreeze LLM + projector for instruction tuning (~150K high-quality examples). Optional stage 4: DPO on preference data.
- **Why:** Each stage serves a specific purpose. Stage 2 teaches the projector to map visual features into the LLM's token space without disrupting the LLM. Stage 3 teaches instruction following, which requires the LLM to be mutable.
- **When:** When fine-tuning any open-weight VLM. Always start from a publicly available pretrained projector checkpoint if possible — skip to Stage 3 for task-specific adaptation.
- **Source:** `research/2026-02-24-vlm-basics.md`

---

### Token Budget Is the #1 Practical Constraint

- **What:** Every image becomes hundreds of LLM tokens before the model processes it. A 336×336 image → ~576 tokens. Dynamic tiling of a 1024×1024 image → 2000+ tokens. Video at 30fps is completely intractable without aggressive subsampling (aim for 1 FPS).
- **Why:** LLM attention is O(n²). Adding 1000 visual tokens to a 500-token prompt increases compute by 9×. Token count directly drives latency and cost.
- **When:** Always profile token count for your typical inputs before committing to an architecture. For high-res documents, prefer models with built-in token compression (Q-Former, grouped MLP projection) over naive concatenation.
- **Source:** `research/2026-02-24-vlm-basics.md`

---

### Use CLIP for Retrieval, Full VLM for Generation

- **What:** For similarity search and ranking tasks, use CLIP/SigLIP embeddings + vector index (pgvector, Faiss). For tasks requiring natural language descriptions, reasoning, or structured extraction from images, use a full generative VLM.
- **Why:** CLIP retrieval is orders of magnitude cheaper than VLM generation. Running LLaVA inference per query at scale is prohibitively expensive. CLIP retrieval reduces the candidate set to a manageable size; VLM generation reranks or describes the top-K.
- **When:** Default to CLIP embeddings for retrieval pipelines. Escalate to VLM generation only when user-facing outputs need natural language or when structured extraction (OCR, layout understanding) is required.
- **Source:** `research/2026-02-24-vlm-basics.md`

---

### VLMs Hallucinate by Default

- **What:** VLMs frequently assert the presence of objects that don't exist in the image, or assign incorrect attributes, especially when the LLM's language prior is strong (e.g., "this kitchen must have a fridge"). Hallucination rates vary dramatically by task and model.
- **Why:** The LLM backbone has strong priors from text pretraining. If an image is ambiguous or the patch embeddings don't strongly contradict the LLM's expectation, it may generate from prior rather than evidence.
- **When:** Always evaluate against POPE (object hallucination) and MMHal-Bench (attribute/spatial hallucination) before production deployment. Consider DPO post-training to reduce hallucination rates. Don't rely on VLM outputs for safety-critical visual decisions without human review.
- **Source:** `research/2026-02-24-vlm-basics.md`

---

### Model Selection by Use Case

- **What:** Start with API models for prototyping (GPT-4o, Claude Sonnet). Move to open-weight for production+privacy (Qwen2.5-VL, InternVL3). Use smallest sufficient model for edge (SmolVLM2 500M for edge, DeepSeek-VL2 for low-latency).
- **Why:** API models have no infrastructure burden but add cost and data exposure. Open-weight models require GPU infrastructure but enable fine-tuning and private data handling.
- **When:**
  - Prototyping → LLaVA 1.6 or GPT-4o API
  - Production + privacy → Qwen2.5-VL (3B-72B) or InternVL3
  - Low latency → DeepSeek-VL2 (MoE, 2.8B active params)
  - Edge / mobile → SmolVLM2 256M-500M
  - OCR-heavy → RolmOCR-7B or PaliGemma 2
  - Complex reasoning → Kimi-VL-Thinking or Gemini 2.5 Pro
- **Source:** `research/2026-02-24-vlm-basics.md`

---

### SigLIP Is Preferred Over CLIP for New Projects

- **What:** SigLIP (2023, Google) replaces CLIP's softmax-normalized contrastive loss with pairwise sigmoid loss. Each image-text pair is treated as an independent binary classification task, eliminating global normalization across the full batch.
- **Why:** SigLIP is more parallelization-friendly (no all-gather across devices), typically produces stronger embeddings, and achieves better zero-shot performance than CLIP at comparable scale. Most 2024+ VLMs (PaliGemma, InternVL3) use SigLIP as the visual backbone.
- **When:** For new embedding-based projects where you'd previously default to CLIP. CLIP is still fine for existing systems and when model availability/compatibility matters.
- **Source:** `research/2026-02-24-vlm-basics.md`

## Revision History
- 2026-02-24: Initial extraction from `research/2026-02-24-vlm-basics.md`.
