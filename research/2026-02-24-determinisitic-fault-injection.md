---
date: 2026-02-24
topic: Deterministic fault injection
status: complete
tags: [testing, distributed-systems, fault-injection, simulation, reliability]
---

# Deterministic Fault Injection

## Context

Investigated after noticing a cluster of highly reliable systems — Dropbox's Nucleus sync engine, TigerBeetle's distributed financial ledger, and SQLite — all using a similar technique: controlled, seed-driven fault injection that can be replayed exactly. The common thread is *determinism*: faults are injected randomly, but the randomness is fully controlled by a seed, so any failure can be reproduced and debugged without heroics. This is distinct from both traditional unit testing (which tests what you *know* can break) and chaos engineering (which injects faults non-deterministically into production or staging).

## Findings

### What Is Deterministic Fault Injection?

Deterministic fault injection (often called Deterministic Simulation Testing or DST when applied at scale) tests distributed systems by:

1. Replacing non-deterministic I/O and concurrency with controlled simulations
2. Using a seeded PRNG to drive *all* random decisions — which faults to inject, in what order, with what parameters
3. Running the system (often as a single-threaded process) through a simulated scenario
4. If a failure occurs, recording the seed — and using it to replay the *exact* failure bit-for-bit

The key invariant: **given the same seed, the test produces the same behavior.** This transforms "I can't reproduce it" from the hardest category of bug into the most tractable.

Sources: [Phil Eaton — What's the big deal about DST?](https://notes.eatonphil.com/2024-08-20-deterministic-simulation-testing.html), [Antithesis DST overview](https://antithesis.com/resources/deterministic_simulation_testing/)

---

### Case Study 1: Dropbox Nucleus Sync Engine

Dropbox rewrote their sync engine in Rust (Nucleus) and built two deterministic randomized testing frameworks: **CanopyCheck** and **Trinity**.

**Shared architecture:** Every randomized test run generates a random seed, instantiates a PRNG with it, and uses that PRNG for *all* random decisions — initial filesystem state, task scheduling, network failure injection. If the test fails, the seed is output. Engineers can re-run locally with that seed to get an identical failure.

**Determinism challenges they solved:**
- Replaced Rust's default randomized HashMap hasher (which uses OS entropy) with a deterministic one
- Serialized all platform API calls to eliminate OS-level non-determinism
- Stored both seed and commit hash as test metadata

**CanopyCheck** tests the planning algorithm (core sync logic):
- Generates random tree configurations via perturbation of realistic states
- Runs the planner iteratively until convergence, randomly shuffling operation batches to verify order-independence
- Verifies invariants: termination, no panics, sync correctness
- Includes automatic *shrinking* — finds the minimal reproduction of a failing case

**Trinity** does end-to-end testing with aggressive fault injection:
- Mocks filesystem, network, and timers to intercept and reorder async requests
- Drives Nucleus as a Rust Future, controlling scheduling to amplify rare race conditions
- Injects: filesystem errors, network delays, reordering, and simulated crashes
- Runs ~10× faster than real filesystem tests, allowing broader seed space exploration
- Runs tens of millions of seeds per night; typically 100% green on latest master

Source: [Testing sync at Dropbox](https://dropbox.tech/infrastructure/-testing-our-new-sync-engine)

---

### Case Study 2: TigerBeetle VOPR

TigerBeetle (a distributed financial accounting database written in Zig) runs its entire cluster in a deterministic flight simulator called VOPR (Viewstamped Operation Replicator).

**Architecture:** An entire TigerBeetle cluster runs inside a single-threaded process. All clock, disk, and network interfaces are simulated. The simulator advances simulated time, not wall-clock time — running at ~1000× speed.

**Fault types injected:**
- Network: packet loss, reordering, corruption, asymmetric partitions
- Storage: high I/O latency, corrupted reads and writes
- Process: crashes and restarts
- Clock: skew between replicas

**Two modes (split in 2023):**
- **Safety mode**: faults injected uniformly at random. Validates strict serializability despite failures.
- **Liveness mode**: starts in safety mode, then selects a healthy quorum, freezes partition faults, and verifies the cluster can still make progress. This discovered a "resonance bug" where replica A requesting log entries from replicas B and C in perfect alternating order prevented recovery indefinitely — a bug safety-mode fuzzing never surfaced.

**Vortex** is a newer complementary layer — a generative full-system test suite that uses a TCP proxy for real network manipulation and actually kills/pauses processes, checking safety and liveness properties across multiple client languages.

Sources: [TigerBeetle simulation testing for liveness](https://tigerbeetle.com/blog/2023-07-06-simulation-testing-for-liveness/), [TigerBeetle safety docs](https://docs.tigerbeetle.com/concepts/safety/)

---

### Case Study 3: FoundationDB & BUGGIFY

FoundationDB (now maintained by Apple) pioneered DST using a custom actor-model language called **Flow** that compiles to C++ and runs single-threaded. The entire cluster runs in one process under simulation.

**Scale:** Tens of thousands of simulations run every night, estimated equivalent to ~1 trillion CPU-hours of simulation. FoundationDB reportedly had "one or two bugs reported by a customer. Ever."

**BUGGIFY macro:** The key differentiator from black-box simulation. BUGGIFY is a macro that can be sprinkled through *production code* to annotate fault injection points:

```cpp
// In production code — will never evaluate to true outside simulation
if (BUGGIFY) {
    throw io_error(); // Force disk error path
}

// Delay injection for concurrency stress
if (BUGGIFY) {
    wait(delay(1.0)); // Inject a 1-second stall
}

// Custom probability
if (BUGGIFY_WITH_PROB(0.001)) {
    // 0.1% chance — rare edge case
}
```

**Rules BUGGIFY follows:**
1. *Simulation-only*: always false in production. This allows liberal use without risk.
2. *Per-run consistency*: the first evaluation enables or disables a given BUGGIFY site for the entire run. This prevents flickering behavior mid-run.
3. *Probabilistic*: enabled sites have a 25% default trigger probability per evaluation.

**Typical uses:**
- Force rare error paths (disk resets, connection failures) into regular coverage
- Inject concurrency delays to surface race conditions
- Randomize tuning parameters to test edge cases
- Skip non-critical operations to stress recovery code paths
- After N simulated seconds, reduce fault frequency to allow system recovery (tests must terminate)

**Key insight:** The production binary includes all BUGGIFY code. There's no separate test/prod build. BUGGIFY never fires in production. This means fault injection code gets real code review, stays up-to-date with production code, and there's no drift between tested and deployed code.

Sources: [BUGGIFY deep dive](https://transactional.blog/simulation/buggify), [FoundationDB simulation docs](https://apple.github.io/foundationdb/testing.html)

---

### Case Study 4: SQLite Fault Injection

SQLite achieves 100% branch coverage (and 100% MC/DC) across its 155.8 KSLOC core using a 590:1 ratio of test-to-source code. Deterministic fault injection is central to this.

**Virtual File System (VFS) approach:** Rather than modifying disk operations, SQLite inserts a custom VFS object rigged to simulate I/O errors after a *set number of I/O operations*. This is fully deterministic — the Nth I/O call fails, reproducibly.

**I/O error simulation:**
- VFS configured to fail at position N
- Loop: run operation, verify database integrity via `PRAGMA integrity_check`, advance N, repeat
- Two modes: fail *once* at N, or fail *continuously* after N (tests both transient and permanent failure recovery)

**OOM (Out-of-Memory) fault injection:**
- Custom malloc instrumented to fail after K allocations
- Loop: run operation with malloc failing at K, verify correct error handling, advance K
- Run twice: single failure and continuous failure after K

**Crash simulation (two approaches):**
- *TCL harness*: spawns child process that runs SQLite and randomly crashes mid-write. A special VFS randomly reorders and corrupts unsynchronized writes (simulates buffered filesystem behavior).
- *TH3 harness* (for embedded systems that can't fork): uses in-memory VFS that snapshots the "filesystem" state after N I/O ops. Crash test replays from snapshot to test recovery.

**Key insight:** SQLite doesn't use random seeds for fault injection — it exhaustively iterates over all failure points (N=1, 2, 3, ...). This is feasible because SQLite is a library, not a distributed system. Exhaustive iteration achieves provably complete coverage; seed-based approaches sample a vast space.

Sources: [How SQLite Is Tested](https://sqlite.org/testing.html)

---

### Case Study 5: WarpStream + Antithesis

WarpStream (a distributed Kafka-compatible streaming system) used **Antithesis** — a commercial DST platform built by former FoundationDB engineers — to test their entire SaaS.

**How Antithesis works:** Rather than requiring architectural changes like FoundationDB's Flow approach, Antithesis runs standard software inside a deterministic hypervisor. The hypervisor controls all sources of non-determinism at the OS/hardware level, instrumenting code coverage automatically.

**What they tested:** End-to-end customer scenarios — account signup, virtual cluster creation, Kafka produce/consume — with multiple producers writing records containing sequence numbers, and consumers verifying monotonicity invariants.

**Results in 6 hours of wall-clock time:**
- 280 application-hours simulated
- Data race in metrics library found in 233 seconds (10,000+ hours of standard testing had never caught it)
- Data loss vulnerability: a file flush refactoring introduced a microsecond-wide race between network failure and flush completion. Standard testing never exposed it. Antithesis triggered it approximately once per hour.

Source: [WarpStream DST blog post](https://www.warpstream.com/blog/deterministic-simulation-testing-for-our-entire-saas)

---

### Case Study 6: S2 Async Rust DST

S2 built DST for an async Rust distributed storage system using a combination of tools:

- **Tokio** with single-threaded scheduler and paused clock (advances only on `sleep()`)
- **Turmoil** for simulated networking between logical hosts on one thread
- **MadSim** for libc symbol overrides (entropy and time)

**Non-determinism sources they had to eliminate:**
- OS-level entropy (fixed via libc overrides)
- HashMap randomization (DOS-protection salting — replaced with deterministic hasher)
- Timestamps in HTTP packets
- Any third-party library making syscalls

**Meta-test approach:** Added tests that compare TRACE-level logs across two runs with the same seed. Byte-level consistency across platforms validated true determinism.

**Outcome:** Discovered 17 notable bugs before production — API semantics, protocol nuances, deadlock conditions.

Source: [S2 DST blog post](https://s2.dev/blog/dst)

---

### Core DST Architecture Patterns

**Pattern 1: Single-process simulation**
Run all nodes as coroutines/tasks on one thread. Eliminate thread scheduling as a source of non-determinism. The scheduler itself becomes deterministic when controlled by the test.

**Pattern 2: Seeded PRNG as single source of randomness**
All random decisions (which fault to inject, by how much, when) draw from one global PRNG seeded at test start. Seed is logged on failure. Replay is trivial.

**Pattern 3: Simulated time**
Replace `clock()` / `Date.now()` with a virtual clock controlled by the test. Advance time deterministically. This also enables fast testing — no real sleeps, no real timeouts.

**Pattern 4: Mocked I/O at boundary**
Implement a shim/VFS/trait/interface that intercepts all I/O. The shim either: (a) uses an in-memory store, (b) injects errors probabilistically via BUGGIFY, or (c) injects errors deterministically at position N.

**Pattern 5: BUGGIFY — cooperative fault injection**
Annotate production code with fault injection hooks. They only fire in simulation. This is more powerful than black-box fault injection because you can target specific code paths with appropriate probabilities.

**Pattern 6: Invariant checking**
Property-based assertions run continuously throughout simulation — not just at the end. Examples: no transaction lost after commit, monotonic sequence numbers, referential integrity.

---

### DST vs. Chaos Engineering

| Dimension | Chaos Engineering (Jepsen, etc.) | Deterministic Simulation Testing |
|---|---|---|
| Environment | Production or realistic staging | Simulated, in-process |
| Reproducibility | Usually non-reproducible | Fully reproducible via seed |
| Speed | Real-time | 100-1000× faster |
| Fault coverage | Limited by real infra | Arbitrary synthetic faults |
| Setup cost | Low (prod-like env exists) | High (sim must be built) |
| Bug discovery rate | Low-moderate | Very high |
| Debugging | Hard (no replay) | Easy (deterministic replay) |
| Best for | Validating real-world assumptions | Finding rare concurrency/failure bugs |

Kyle Kingsbury (creator of Jepsen) did not test FoundationDB with Jepsen — "because he didn't think he'd find anything." That's a meaningful signal about DST's thoroughness.

---

### Implementation Approaches (Build vs. Buy)

**FoundationDB model (build from scratch):**
Design the entire system with simulation in mind. Requires a custom actor framework or async runtime with simulation support. Highest fidelity — the sim can model very specific failure modes. Impractical to retrofit.

**Retrofit model (libraries):**
Use simulation-aware libraries like Turmoil (Rust network simulation), madsim (full async Rust sim), or Go WASM + modified runtime (Polar Signals). Still requires controlling entropy and time. Partial determinism is achievable with moderate effort.

**Hypervisor model (Antithesis):**
Run unmodified software inside a deterministic OS/hypervisor. No architectural changes needed. Commercial product. Trade-off: less ability to inject application-level faults (only OS-level non-determinism is controlled).

**Exhaustive iteration model (SQLite-style):**
Don't use random seeds — iterate exhaustively over all failure points. Works for libraries with bounded I/O sequences. Not scalable to distributed systems with unbounded interaction spaces.

---

### Key Challenges

1. **Sources of hidden non-determinism:** Any syscall, any library using wall-clock time, any HashMap with DOS-protection salting, any thread pool — all break determinism. Eliminating these requires diligence and meta-tests to verify.

2. **Seed decay:** A seed reproduces a bug at a specific commit. After code changes, the same seed may not trigger the same bug. Bugs found in CI should be immediately triaged, not stored for later.

3. **Workload design is hard:** Will Wilson (FoundationDB): "tuning all the random distributions, the parameters of your system, the workload, the fault injection... so that it produces interesting behavior is very challenging and very labor intensive." Coverage metrics alone are insufficient — you need specialized assertions to verify state space exploration.

4. **Mock fidelity:** Simulated faults must model real failure modes. "I/O fails" is easy; "I/O succeeds for 4KB then fails mid-write" is harder; "storage controller silently corrupts every 10,000th write" requires deep knowledge.

5. **Recovery phases:** Pure fault injection never lets the system stabilize. Good simulations reduce fault frequency after N simulated seconds to verify the system can fully recover and process new work.

---

### When to Invest

DST ROI is highest when:
- Your system makes durability/consistency guarantees that users rely on
- Failure modes are combinatorial (network + disk + crash all happening together)
- The system is too complex for exhaustive unit test coverage of failure paths
- You're pre-production and want to find bugs before users do

DST is overkill when:
- You're building a stateless API layer with no durability guarantees
- Failures are simple and independent (one service, one fault mode)
- You can tolerate production incidents for learning

The minimum viable version: **just seed your PRNG and output the seed on failure.** This gives you reproducibility with almost zero investment. Full VOPR-style simulation is a multi-month engineering project, but the seed pattern takes an hour.

## Open Questions

- Are there emerging frameworks that make DST accessible for TypeScript/Node.js distributed systems? (Turmoil is Rust, madsim is Rust; Go options are limited)
- How does simulation testing interact with database migrations — can you simulate schema changes in the middle of a simulation run?
- What's the relationship between DST and formal verification (TLA+, Alloy)? Could a TLA+ spec drive seed generation?
- Antithesis is closed-source commercial; are open-source hypervisor-model alternatives maturing?
- How do teams maintain BUGGIFY annotations as code evolves — is there tooling for tracking fault injection coverage?

## Extracted Principles

Principles extracted to `principles/testing-strategy.md` under a new "Deterministic Fault Injection" section.
