# Post-Quantum Blockchain Security

## Summary

Principles for securing blockchain, custody, bridge, and tokenization systems against future quantum-capable signature forgery. The core pattern is to rank risk by exposed keys and blast radius, reduce exposure immediately, and design migration around cryptographic agility instead of a one-shot algorithm swap.

## Principles

### Prioritize by Exposure and Privilege Concentration
- **What:** Inventory every key by whether its public key is exposed and by what that key can control. Hot wallets, admin multisigs, validator keys, bridge keys, and upgrade authorities should be assessed before ordinary user balances.
- **Why:** Quantum risk is highly uneven. A small number of exposed privileged keys can represent far more systemic danger than a large number of low-value user keys.
- **When:** At the start of any blockchain, custody, stablecoin, or tokenization post-quantum program. Re-run the inventory continuously as key roles and balances change.
- **Source:** [research/2026-04-01-look-into-https-quantumai-google-static-site-assets-downloads-cryptocurrency-whitepaper-pdf.md](../research/2026-04-01-look-into-https-quantumai-google-static-site-assets-downloads-cryptocurrency-whitepaper-pdf.md)

### Treat Exposure Reduction as an Interim Control
- **What:** Use fresh addresses, avoid public-key reuse, and route high-value transactions away from public mempools when possible, but treat those moves as time-buying controls only.
- **Why:** These controls can reduce on-spend risk and unnecessary exposure, but they do not solve the long-term problem of quantum-vulnerable signature schemes or already-exposed dormant keys.
- **When:** Immediately. Apply while the longer protocol, wallet, and custody migration is still being designed and rolled out.
- **Source:** [research/2026-04-01-look-into-https-quantumai-google-static-site-assets-downloads-cryptocurrency-whitepaper-pdf.md](../research/2026-04-01-look-into-https-quantumai-google-static-site-assets-downloads-cryptocurrency-whitepaper-pdf.md)

### Build Cryptographic Agility Before Picking a Permanent PQ Scheme
- **What:** Add key rotation, upgradeable signature validation paths, account-abstraction-like indirection, or equivalent agility mechanisms before hard-coding a final post-quantum scheme into the system.
- **Why:** PQC standards and implementations are still maturing. Agility reduces lock-in risk, eases rollback, and lets teams migrate users gradually instead of forcing a brittle flag day.
- **When:** During architecture and migration design. Especially important for account-based systems, bridges, wallets, and protocols with long governance lead times.
- **Source:** [research/2026-04-01-look-into-https-quantumai-google-static-site-assets-downloads-cryptocurrency-whitepaper-pdf.md](../research/2026-04-01-look-into-https-quantumai-google-static-site-assets-downloads-cryptocurrency-whitepaper-pdf.md)

### Separate Dormant-Asset Governance From Active-Asset Migration
- **What:** Track dormant, abandoned, or likely-lost balances as a separate program with explicit governance and policy decisions, rather than folding them into normal wallet migration.
- **Why:** Technical migration paths only help assets that can still move. Exposed dormant balances create a different class of systemic and political risk that protocol code alone cannot resolve.
- **When:** UTXO systems with early exposed outputs, old account systems with long-abandoned keys, and any tokenized-asset environment with a long tail of inactive balances.
- **Source:** [research/2026-04-01-look-into-https-quantumai-google-static-site-assets-downloads-cryptocurrency-whitepaper-pdf.md](../research/2026-04-01-look-into-https-quantumai-google-static-site-assets-downloads-cryptocurrency-whitepaper-pdf.md)

## Revision History
- 2026-04-01: Initial extraction from [research/2026-04-01-look-into-https-quantumai-google-static-site-assets-downloads-cryptocurrency-whitepaper-pdf.md](../research/2026-04-01-look-into-https-quantumai-google-static-site-assets-downloads-cryptocurrency-whitepaper-pdf.md).
