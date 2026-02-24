---
date: 2026-02-24
topic: VLM basics
status: complete
tags: [ai, ml, vision, multimodal, architecture]
---

# VLM Basics: How Vision-Language Models Work

## Context

This research was initiated to understand the fundamental mechanics of Vision-Language Models (VLMs) — how they work at a technical level, how they're trained, and how to think about using them. The venue recommendation engine (see `2026-02-23-multi-modal-venue-recommendation-engine.md`) uses CLIP as a component, which is itself a foundational VLM. Understanding VLMs more broadly informs better use of the multi-modal stack.

---

## Findings

### 1. What Is a VLM?

A VLM is an AI model that understands both images (or video) and natural language, mapping the relationships between visual data and text. Unlike text-only LLMs (which can't process images) or vision-only models (which can't explain findings), VLMs enable joint reasoning across modalities in a single model.

**Core capabilities:**
- Visual Question Answering (VQA): "What is the dog doing?"
- Image captioning: Generate text from images
- Zero-shot classification: "Is this image of a corgi or a poodle?" (no training labels needed)
- Document understanding: PDFs, screenshots, charts, tables
- Object detection / grounding: Locate specific objects described in text
- OCR and reading: Extract text from images
- Video understanding: Frame-by-frame or temporal reasoning

**What sets them apart from pure vision models:** a ResNet/YOLO can identify objects but cannot produce natural language. VLMs bridge this — they can identify the cat breed, describe the scene, and answer follow-up questions in one workflow. (Source: [code-b.dev](https://code-b.dev/blog/vision-llm))

---

### 2. Core Architecture: The Three-Component Stack

Modern generative VLMs (GPT-4o, Claude Sonnet, LLaVA, Qwen2.5-VL, etc.) share a standard three-part architecture:

```
Image Input
    ↓
[ Vision Encoder ]     — Converts image pixels → feature embeddings
    ↓
[ Projection Layer ]   — Translates vision embeddings → LLM token space
    ↓
[ LLM Backbone ]       — Generates text (reasoning, answers, captions)
    ↓
Text Output
```

#### 2a. Vision Encoder

The vision encoder converts raw pixel data into numerical feature vectors.

**Dominant approach: Vision Transformer (ViT)**

Introduced by Dosovitskiy et al. (Google, 2020). Key idea: treat an image the same way a text transformer treats words.

1. Split the image into fixed-size patches (e.g., 14×14 or 16×16 pixels each)
2. Linearly project each patch into a vector (patch embedding)
3. Add a `[CLS]` token and positional embeddings
4. Process all patch embeddings through a Transformer encoder
5. Output: a sequence of high-dimensional vectors, one per patch

Result: a 224×224 image at 16×16 patches → 196 patch tokens, each a 768-dimensional vector (for ViT-B/16).

**CLIP as a vision encoder:** Most VLMs don't train their vision encoder from scratch. They use CLIP (or SigLIP) — a model that has already learned rich visual representations via large-scale contrastive pretraining on 400M image-text pairs. CLIP's ViT produces semantically meaningful patch vectors that are already "close" to the language domain, making alignment much easier. (Source: [Rohit Bandaru's VLM blog](https://rohitbandaru.github.io/blog/Vision-Language-Models/))

**Modern refinements:**
- **Native/Dynamic Resolution:** Early ViTs required fixed input size (e.g., 224×224), losing detail in high-res images. Modern approaches (Qwen2.5-VL, LLaVA 1.6) use dynamic tiling — splitting large images into crops and processing each at native resolution, then re-merging patch embeddings.
- **SigLIP (2023):** Drop-in CLIP replacement that uses pairwise sigmoid loss instead of softmax normalization. Better parallelization for distributed training, and produces stronger embeddings. (Source: [Rohit Bandaru](https://rohitbandaru.github.io/blog/Vision-Language-Models/))

#### 2b. Projection Layer (Adapter / Connector)

The vision encoder outputs vectors in its own embedding space (e.g., 768d for ViT-B, 1024d for ViT-L). The LLM lives in a different space (e.g., 4096d for Vicuna-7B). The projection layer bridges this gap.

This is arguably the most critical component: "the most important part of the VLM is the projection layer which converts the image patch vectors into the word token space." (Source: [Groundlight AI](https://www.groundlight.ai/blog/how-vlm-works-tokens))

**Why information density matters:** A 4096-dimensional vision token encodes approximately 16 kilobits of information — far more than a single word token (which selects one from ~50K vocabulary → ~15 bits). Vision tokens are information-dense, which is why even a small number of visual tokens meaningfully enriches the LLM's context.

**Three projection approaches:**

1. **MLP Adapter (LLaVA-style, most common):**
   - A 2-layer MLP maps ViT vectors → LLM embedding space
   - Output tokens are concatenated to the text token sequence
   - LLM applies full attention to visual tokens, causal (autoregressive) attention to text tokens
   - Simple, effective, widely used: LLaVA, Qwen-VL2, LLaMA 3.2-Vision, PaliGemma 2, DeepSeek-VL
   - Some models compress groups of 4 visual tokens → 1 via MLP (Qwen2.5-VL) to reduce token count

2. **Q-Former (BLIP-2 / InstructBLIP):**
   - Introduces learned "query" vectors that cross-attend to vision tokens
   - Output is a fixed number of query embeddings regardless of image resolution
   - Allows graceful handling of variable resolutions and image count
   - More parameters, more controlled token length

3. **Cross-Attention Mid-Fusion (Flamingo, LLaMA 3.2):**
   - Visual information is injected into the LLM via dedicated cross-attention layers inserted between LLM transformer blocks
   - Not at the input level — vision conditions the entire generation process
   - More powerful for complex grounding but architecturally heavier
   - LLaMA 4 moved *back* to early-fusion MLP for "native multimodality"

(Source: [Rohit Bandaru's VLM blog](https://rohitbandaru.github.io/blog/Vision-Language-Models/), [HuggingFace VLM pretraining](https://huggingface.co/blog/vision_language_pretraining))

#### 2c. LLM Backbone

This is the standard autoregressive language model — GPT-style, decoder-only. It receives:
- The projected visual tokens (from the projection layer)
- The text prompt tokens

And generates a response autoregressively. The LLM does all the "reasoning" about what it saw.

Key design choice: **what to freeze during training.** Vision encoders are often kept frozen (they contain valuable pretrained representations). LLM backbones are initially frozen during the projector alignment stage, then unfrozen during SFT.

---

### 3. CLIP: The Foundational Dual-Encoder VLM

CLIP (Contrastive Language–Image Pretraining, OpenAI 2021) is the most influential building block in the VLM ecosystem. It is NOT a generative model — it cannot output text or images. But it creates a shared embedding space that almost all later VLMs exploit.

**Architecture:**
- **Image encoder:** Vision Transformer (ViT) or ResNet
- **Text encoder:** Transformer (BERT-like)
- Both produce fixed-dimensional vectors (512d or 1024d)
- Vectors from matching image-text pairs should be close (high cosine similarity); vectors from mismatched pairs should be far apart

**Training objective — Contrastive Loss:**

For a batch of N image-text pairs, CLIP builds an N×N similarity matrix. The diagonal (matching pairs) should be high; off-diagonal (mismatched) should be low.

```
Loss = symmetric cross-entropy over the N×N similarity matrix
     = 0.5 × (image-to-text loss + text-to-image loss)
```

Temperature parameter τ scales the logits.

CLIP trained on 400M noisy web image-text pairs (WebImageText dataset). Despite noisy data, contrastive learning is remarkably robust.

**Zero-shot inference (CLIP's killer feature):**
```python
# No fine-tuning needed. Just embed the class names and compare:
text_labels = ["a photo of a dog", "a photo of a cat", "a photo of a car"]
image_embedding = clip.encode_image(image)
text_embeddings = clip.encode_text(text_labels)
scores = cosine_similarity(image_embedding, text_embeddings)  # pick argmax
```

**Why CLIP as a building block?** Because its ViT has already learned semantically rich, language-aligned visual representations. Plugging it into a VLM means you don't need to train vision understanding from scratch — you just need to train the projector to adapt CLIP vectors for the LLM. (Source: [Rohit Bandaru](https://rohitbandaru.github.io/blog/Vision-Language-Models/), [HuggingFace VLM blog](https://huggingface.co/blog/vlms))

---

### 4. Training a Generative VLM: Multi-Stage Pipeline

Modern VLMs (LLaVA paradigm) use a 2-3 stage training process:

#### Stage 0: Pretrain Components Separately
- Vision encoder (CLIP/SigLIP): pretrained on massive image-text pairs via contrastive learning
- LLM backbone (Llama, Mistral, Qwen, etc.): pretrained on text corpora
- Projector: randomly initialized, needs to learn alignment

#### Stage 1: Projector Pre-alignment
- **Freeze:** vision encoder + LLM backbone
- **Train:** projection layer only
- **Data:** ~600K image-caption pairs (LLaVA uses CC3M filtered through GPT-4 to generate Q&A pairs)
- **Objective:** teach the projector to map vision embeddings into the LLM's token space
- **Why freeze:** LLM's representations are valuable; we don't want to disrupt them yet

#### Stage 2: Visual Instruction Tuning (SFT)
- **Freeze:** vision encoder (still frozen)
- **Unfreeze:** LLM backbone + projector
- **Data:** ~150K high-quality instruction-following examples (conversations, detailed descriptions, complex reasoning)
- **Objective:** train the model to follow instructions about visual content
- **LLaVA trick:** GPT-4 was used to generate synthetic instruction data from *captions and bounding boxes* (not the images themselves) — then this data was used to train the VLM. Visual annotations serve as a textual proxy.

#### Stage 3 (optional): RLHF / DPO Post-training
- Direct Preference Optimization (DPO) on chosen/rejected response pairs
- Reduces hallucination, improves instruction following
- Dataset: RLAIF-V (83K+ samples)
- Modern frontier models (GPT-4o, Gemini, Claude Sonnet) all use extensive RLHF/RLAIF stages

**Key insight from research:** Text-only performance slightly *decreases* when you add vision training. This is why models like Qwen release separate text-only and multimodal variants. Maintaining ~40% text data in training mixtures (Kimi-VL approach) mitigates this regression. (Source: [Rohit Bandaru's VLM blog](https://rohitbandaru.github.io/blog/Vision-Language-Models/))

---

### 5. Pretraining Objectives Taxonomy

Different VLM approaches use different pretraining signals:

| Objective | Description | Key Models | Best For |
|-----------|-------------|------------|----------|
| **Contrastive (ITC)** | Maximize similarity of matching pairs, minimize mismatched | CLIP, ALIGN, SigLIP | Zero-shot classification, retrieval |
| **Image-Text Matching (ITM)** | Binary: does this caption match this image? | VisualBERT, BLIP, FLAVA | Fine-grained alignment |
| **Masked Language Modeling (MLM)** | Predict masked words given image context | VisualBERT, LXMERT, FLAVA | Region-level alignment |
| **PrefixLM** | Predict text continuation given image patches + text prefix | SimVLM, Flamingo | Generation tasks |
| **Autoregressive LM** | Next-token prediction including visual tokens | LLaVA, GPT-4o, Gemini | General-purpose generation |

FLAVA (Meta) uses all four simultaneously (MLM + ITM + MIM + contrastive) to cover both unimodal and multimodal tasks. (Source: [HuggingFace VLM pretraining](https://huggingface.co/blog/vision_language_pretraining))

---

### 6. Token Budget: The Computational Challenge

Every image becomes hundreds of tokens before the LLM sees it:
- 224×224 image at 14×14 patches → **256 visual tokens**
- 336×336 image (LLaVA 1.6 default) → ~576 tokens
- Dynamic tiling of a 1024×1024 image → potentially **~2000+ tokens**

LLM attention is O(n²) with sequence length. Visual tokens inflate context dramatically. This drives extensive research into **token compression**:

- **Q-Former (BLIP-2):** Fixed 32 query tokens regardless of image size
- **4:1 MLP compression (Qwen2.5-VL):** Groups of 4 visual tokens projected to 1
- **Run-Length Tokenization (video):** Consecutive identical patches → single token + duration

**Video is extreme:** 1-minute 30fps video = ~460K tokens at full sampling (equivalent to a 700-page book). Practical mitigations:
- 1 FPS sampling → ~15K tokens for 1-minute video
- 3D patch projection (Conv3D aggregates multiple frames into one token)
- Frame-timestamp interleaving

(Source: [Rohit Bandaru](https://rohitbandaru.github.io/blog/Vision-Language-Models/), [HuggingFace VLMs 2025](https://huggingface.co/blog/vlms-2025))

---

### 7. Notable Models and Ecosystem (2025/2026)

#### Closed / Frontier
| Model | Provider | Notable |
|-------|----------|---------|
| GPT-4o | OpenAI | Best-in-class, native multimodal |
| Claude Sonnet 4.6 | Anthropic | "Thinking" reasoning mode |
| Gemini 2.5 Pro | Google | Long-context (2M tokens), video |

#### Open Source
| Model | Params | Notes |
|-------|--------|-------|
| **Qwen2.5-VL** | 3B–72B | Versatile, strong agentic tasks, dynamic resolution |
| **InternVL3** | 2B–72B | Matches GPT-4o on many benchmarks |
| **LLaVA 1.6** | 7B–34B | Industry standard reference architecture |
| **PaliGemma 2** | 3B–28B | Google, strong on OCR/grounding |
| **DeepSeek-VL2** | 2.8B active (MoE) | Low latency, mixture-of-experts |
| **Llama 4 Scout** | 109B MoE | Extended context, meta's native multimodal |
| **SmolVLM2** | 256M–2.2B | Edge deployment, video support |
| **Molmo** | 1B–72B | Open, specialized in detection/pointing |
| **Kimi-VL** | 16B MoE (2.8B active) | Best open reasoning model, long video |

#### 2025 Architectural Trends (Source: [HuggingFace VLMs 2025](https://huggingface.co/blog/vlms-2025))
1. **Any-to-any models** (image + text + audio/speech → any output)
2. **MoE decoders** (40-70% inference latency reduction by activating only relevant experts)
3. **Reasoning/thinking models** (step-by-step chain-of-thought before responding)
4. **Vision-Language-Action (VLA)** models for robotics (π0, NVIDIA GR00T)
5. **Sub-2B edge models** with competitive performance

---

### 8. Evaluation and Benchmarks

| Benchmark | Focus | Challenge |
|-----------|-------|-----------|
| **MMMU** | 11.5K college-level multimodal Q&A across 30 disciplines | Complex academic reasoning |
| **MMBench** | 3K multiple-choice, 20 skills (OCR, localization, etc.) | Broad capability coverage |
| **MMMU-Pro** | 10-choice vs 4-choice, vision-only questions | Harder than MMMU |
| **MMT-Bench** | 31K+ questions, 32 meta-tasks | Multi-task evaluation |
| **POPE** | Object hallucination via binary probing | Does model claim objects that aren't there? |
| **MMHal-Bench** | Multi-category hallucination (attributes, spatial, counting) | Open-ended hallucination assessment |
| **VQA v2** | Classic visual question answering | Standard baseline |
| **TextVQA** | Text in images (OCR + reasoning) | Document/scene text understanding |
| **ViDoRe** | Visual document retrieval (ColPali benchmark) | Document screenshot retrieval |
| **Vision Arena** | Human preference-based | Real-world preference alignment |

**Benchmark limitation:** Academic benchmarks (especially MMMU) use multiple-choice format and synthetic content. They poorly measure enterprise-critical tasks like structured description generation, fine-grained classification, and real-world document layout parsing. (Source: [arxiv VLM benchmark survey](https://arxiv.org/html/2501.02189v3))

---

### 9. Known Limitations and Failure Modes

#### Hallucination
VLMs frequently "hallucinate" — they claim to see objects that aren't in the image, or attribute incorrect properties. Root causes:
- Language prior dominance: if a kitchen scene is described, the LLM expects a refrigerator — even if there isn't one in this image
- Contrastive pretraining doesn't fully eliminate spurious correlations
- Mitigation: POPE evaluation, DPO post-training, grounding-aware fine-tuning

#### Spatial Reasoning
Current VLMs struggle with precise spatial relationships: "Is the red ball to the left or right of the blue cube?" Standard patch-based ViTs encode global content well but don't inherently preserve precise spatial relationships. Specialist models (Molmo, with pointing ability) improve this.

#### Counting
VLMs are unreliable at counting objects, especially beyond ~5. ViT patch embeddings lose exact positional structure needed for counting.

#### Fine-Grained Classification
Standard benchmarks don't evaluate fine-grained distinctions (specific dog breeds, plant species). VLMs can struggle when required to distinguish visually similar categories the LLM hasn't seen much text about.

#### Resolution Trade-offs
Higher resolution = better visual detail = more tokens = slower inference = higher cost. Dynamic tiling helps but multiplies token count by 4-16x for large images.

#### Text-Only Performance Regression
Adding vision training slightly degrades pure text performance. Models address this by mixing text-only data during training (~40% text data throughout all stages).

(Source: [code-b.dev](https://code-b.dev/blog/vision-llm), [arxiv benchmark survey](https://arxiv.org/html/2501.02189v3))

---

### 10. Practical Guidance: Using VLMs

#### Model Selection Decision Framework

| Need | Recommended Approach |
|------|---------------------|
| Prototyping / quick start | LLaVA 1.6 via HuggingFace |
| Production + fine-tuning + privacy | Qwen2.5-VL or InternVL3 |
| Low latency (embedded/edge) | SmolVLM2 (500M) or DeepSeek-VL2 |
| Best overall accuracy | GPT-4o or Claude Sonnet via API |
| OCR heavy workloads | RolmOCR-7B or PaliGemma 2 |
| Complex reasoning tasks | Kimi-VL-Thinking or Gemini 2.5 Pro |
| Grounding / detection | Molmo, OWL-ViT, Qwen2.5-VL |

#### Quick Inference (HuggingFace)

```python
from transformers import LlavaNextProcessor, LlavaNextForConditionalGeneration
import torch
from PIL import Image
import requests

processor = LlavaNextProcessor.from_pretrained("llava-hf/llava-v1.6-mistral-7b-hf")
model = LlavaNextForConditionalGeneration.from_pretrained(
    "llava-hf/llava-v1.6-mistral-7b-hf",
    torch_dtype=torch.float16,
    low_cpu_mem_usage=True
).to("cuda")

image = Image.open(requests.get("https://example.com/image.jpg", stream=True).raw)
prompt = "[INST] <image>\nWhat is in this image? [/INST]"

inputs = processor(prompt, image, return_tensors="pt").to("cuda")
output = model.generate(**inputs, max_new_tokens=200)
print(processor.decode(output[0], skip_special_tokens=True))
```

#### Local Inference (Apple Silicon)
```bash
python3 -m mlx_vlm.generate \
  --model HuggingfaceTB/SmolVLM-500M-Instruct \
  --image /path/to/image.jpg \
  --prompt "What is in this image?"
```

#### Fine-Tuning Approaches

1. **Full SFT with TRL:** For task-specific adaptation. Unfreeze LLM + projector, freeze vision encoder. Use `SFTTrainer` from TRL library.
2. **QLoRA:** Quantized LoRA fine-tuning. Can adapt a 70B VLM on a single A100 GPU. Apply to LLM backbone layers only.
3. **DPO:** Use chosen/rejected pairs (RLAIF-V dataset) to reduce hallucination and improve instruction following.

**Freezing heuristic:** Always start with vision encoder frozen. Unfreeze only if task requires novel visual concepts not covered by CLIP's pretraining.

#### Production Deployment Considerations
- **Token budget:** Profile visual token count for your typical inputs. High-res images with dynamic tiling can easily hit 2K+ visual tokens.
- **Batching:** VLMs benefit from batching — group requests with similar image sizes.
- **Serverless GPU:** SmolVLM2 runs on consumer GPUs (8GB VRAM). Larger models (72B) need 2× A100s at minimum.
- **Bias/fairness:** Sample 100-500 outputs for human review before production. VLMs inherit biases from web-scraped training data.

(Source: [HuggingFace VLM blog](https://huggingface.co/blog/vlms), [HuggingFace VLMs 2025](https://huggingface.co/blog/vlms-2025))

---

### 11. The CLIP Embedding Space and the Venue Finder Use Case

The venue recommendation system (using ViT-B/32 CLIP) sits at the "vision encoder only" tier of the VLM stack — it uses CLIP's shared embedding space to compare images and text semantically, but doesn't add a generative LLM decoder. This is a deliberate efficiency choice: CLIP embeddings + pgvector retrieval is orders of magnitude cheaper than running full VLM inference per query.

The tradeoff: CLIP can compare "an image of a rustic barn venue" to a text query, but can't answer "describe what this venue is like for a summer wedding" — for that you need a full generative VLM.

When integrating VLMs into recommendation pipelines, the right layer depends on the task:
- Retrieval/ranking → CLIP/SigLIP embeddings (fast, cheap)
- Description generation → Full VLM (LLaVA, Qwen2.5-VL)
- Structured extraction from image → Full VLM + structured output

---

## Open Questions

1. **Interleaved image-text training:** Most open models aren't trained on documents that mix images and text (like PDFs). How much does this limit their document understanding vs. frontier models trained on interleaved data?
2. **VLM-based re-ranking:** Could a lightweight VLM (SmolVLM2 256M) replace the CLIP retriever in the venue finder for better semantic richness? What's the latency/accuracy tradeoff?
3. **Positional encoding for images:** ViT uses 2D positional embeddings for patches, but this doesn't scale to arbitrary resolutions cleanly. How do native-resolution models (Qwen2.5-VL's NaViT-style approach) handle this?
4. **VLA models for non-robotics tasks:** Could Vision-Language-Action models be adapted for GUI automation (web agents, form filling) in production? What frameworks support this?
5. **Hallucination mitigation without DPO:** Are there architectural (vs. training-time) techniques to reduce object hallucination?

---

## Extracted Principles

Key principles distilled from this research have been added to `principles/vlm-basics.md` (new file):

- CLIP is the foundation, not an endpoint — understand it as the "visual vocabulary" all generative VLMs build on
- Three-stage training is standard: contrastive pretraining → projector alignment → instruction tuning
- Freeze vision encoder by default; only unfreeze for novel visual domains
- Token budget is the #1 practical constraint — always profile visual token counts before deployment
- For retrieval use CLIP; for generation use a full VLM — don't overengineer the wrong layer
- VLMs hallucinate by default — benchmark against POPE/MMHal-Bench before trusting production outputs
