# FHIR Subscription Architecture: Comparative Analysis

**CMS Interoperability Framework — Subscriptions Workgroup**

*Simulation-based analysis of three notification architectures at U.S. scale*

---

## Executive Summary

This report presents a simulation-based comparison of three proposed architectures for delivering FHIR encounter and appointment notifications across CMS-Aligned Networks at U.S. population scale (~342 million people). The simulation models a synthetic but realistic ecosystem of 11 networks, 12,000 provider organizations, 80 patient app vendors, and 15 payers, then projects annual message volumes, subscription state, and per-stakeholder operational burden for each architecture.

**Key finding:** The three architectures make fundamentally different tradeoffs. No architecture dominates across all dimensions. The choice depends on which stakeholder burdens the community considers most acceptable.

| Dimension | A (Subscriptions Broker) | B (Source Feed) | C (Encrypted Relay) |
|-----------|--------------------------|-----------------|---------------------|
| Total annual messages | 13.1B | **8.6B** (lowest) | 17.9B |
| Data plane messages | 10.5B | **5.1B** | 11.8B |
| Control plane messages | **2.6B** (lowest) | 3.5B | 6.1B |
| Source subscription burden | **0** | 1.54B | **0** |
| Source outbound msgs/day (p95) | **1,798** | 3,228 | 2,737 |
| Network relay messages | 10.5B | **1.1B** (lowest) | 11.8B |
| App subscriptions per patient | **1** | 4 | **1** |
| Ghost subscription risk | **None** | 10.2M (0.7%) | **None** |

---

## 1. Architecture Overview

### A. Subscriptions Broker

Clients (apps, payers) create a single subscription at their network's Broker. Events flow from data sources through networks: Source → Source Network → Peer Networks → Clients. The Broker handles all routing, fan-out, and data retrieval (proxy mode). Sources have a single integration point (their network) and manage zero direct client subscriptions.

### B. Relationship Feed + Source Feed

Clients subscribe at their Home Broker for new-care-relationship signals only (control plane). When notified of a new source, the client subscribes directly at that source's feed endpoint for ongoing clinical data (data plane). Peer Brokers use multiplexed subscriptions with subject-handle aggregation, so cross-network signaling scales per-patient, not per-client. The Home Broker is not in the data path for ongoing notifications.

### C. Encrypted Relay

Same routing topology as A, but notifications are encrypted at the source before relay. Sources request public keys from their network and produce per-recipient-category encrypted blobs. Networks relay encrypted content without being able to read it. Key propagation to sources and networks creates additional control plane overhead.

---

## 2. Synthetic Ecosystem

The simulation generates a representative U.S.-scale ecosystem with the following baseline characteristics:

| Parameter | Value |
|-----------|-------|
| Population | 342,415,247 |
| Patient app enrollment | 19.9% (mean 1.21 apps per enrolled patient) |
| Payer enrollment | 90.0% (mean 1.28 payers per patient) |
| Provider relationships per patient | mean 2.19, median 2, p95 = 6 |
| Distinct provider networks per patient | 1.06 |
| Clinical episodes per patient per year | 3.49 |
| Networks | 11 (4 provider-centric, 3 balanced, 4 app-centric) |
| Provider organizations | 12,000 |
| App vendors | 80 |
| Payers | 15 |

The ecosystem uses heavy-tailed distributions for organization size, app vendor popularity, and patient utilization, producing realistic long-tail behavior where a small fraction of patients and sources account for disproportionate volume.

---

## 3. Baseline Results

### 3.1 Message Volume

|  | A | B | C |
|--|---|---|---|
| **Data plane msgs** | 10.5B | 5.1B | 11.8B |
| **Data plane bytes** | 13,735 GiB | 5,978 GiB | 18,248 GiB |
| **Control plane msgs** | 2.6B | 3.5B | 6.1B |
| **Control plane bytes** | 969 GiB | 1,832 GiB | 4,524 GiB |
| **Total msgs** | 13.1B | 8.6B | 17.9B |
| **Mean msgs/day** | 35.9M | 23.7M | 49.0M |
| **P95 msgs/day** | 36.3M | 24.0M | 49.6M |

**Why A has more data-plane messages than B:** In Architecture A, every clinical notification traverses a relay chain — source sends 1 message to its network, the network relays to each relevant peer network, and each peer network fans out to individual clients. These intermediate relay hops add messages that don't exist in B, where sources send directly to subscribers. The relay overhead roughly doubles the total message count even though the number of final deliveries to clients is similar.

**Why B has more control-plane messages than A:** B requires direct source subscriptions for every client-source pair. Creating, maintaining, and churning these subscriptions (1.54 billion in baseline) generates substantial control traffic. A's clients maintain a single Broker subscription each, with the network handling routing internally.

### 3.2 Subscription and Routing State

|  | A | B | C |
|--|---|---|---|
| App → Broker subs | 82.2M | 82.2M | 82.2M |
| Payer → Broker subs | 438.2M | 438.2M | 438.2M |
| Peer interest copies | 5.44B | 5.44B | 5.72B |
| **Direct source subs** | **0** | **1.54B** | **0** |
| Ghost subs | 0 | 10.2M | 0 |
| Keys at sources | 0 | 0 | 1.15B |

The defining state difference is Architecture B's 1.54 billion direct source subscriptions. This number is the product of every enrolled patient's apps + payers + care-team providers multiplied by their number of active data sources. Breaking down B's direct source subscriptions:

- **Payers: 959M** (62% of total) — the dominant contributor
- **Providers: 391M** (25%) — care-team members subscribing to peer sources
- **Apps: 188M** (12%) — patient apps subscribing to each source

### 3.3 Per-Source Burden

This is where the architectural difference is most operationally significant.

|  | A | B | C |
|--|---|---|---|
| Subscriptions managed per source | **0** | **128,166** (mean) | **0** |
| Subscriptions managed (p95 source) | **0** | **419,459** | **0** |
| Outbound msgs per source per day (mean) | 533 | 919 | 809 |
| Outbound msgs per source per day (p95) | 1,798 | 3,228 | 2,737 |

In Architecture A, a data source sends events only to its network — one authenticated connection, zero subscription management. In Architecture B, a p95 source manages **419,459 direct subscriptions** and sends **3,228 messages per day**. This means every participating provider EHR must operate what amounts to a subscription management platform at scale.

Architecture C adds encryption overhead but maintains the same zero-subscription-at-source model as A.

### 3.4 Per-Stakeholder Analysis

#### Data Sources (Providers / EHRs)

|  | A | B | C |
|--|---|---|---|
| Annual outbound msgs | 2.34B | 4.02B | 3.54B |
| Annual auth checks | 2.34B | 4.02B | 3.54B |
| Subs to manage | **0** | **1.54B** | **0** |

Architecture A is the lightest touch for data sources. Sources authenticate once against their network and fire a single message per clinical event. Architecture B requires sources to accept, authenticate, and serve direct subscriptions from potentially hundreds of thousands of clients per source.

#### Networks / Brokers

|  | A | B | C |
|--|---|---|---|
| Total relay msgs | 10.5B | **1.1B** | 11.8B |
| Fan-out to clients | 5.0B | **518M** | 5.0B |
| Routing state | 6.0B | 6.0B | 6.2B |

Architecture B is dramatically lighter for networks — 90% less relay traffic. In B, networks handle only new-care-relationship signals and peer multiplexing; they are not in the data path for ongoing clinical notifications. Architectures A and C place networks in the center of every clinical data flow.

#### Patient Apps

|  | A | B | C |
|--|---|---|---|
| Total subscriptions | 82.2M | 270.6M | 82.2M |
| Notifications received | 592.8M | 534.4M | 592.8M |
| Subs per enrolled patient | **1.0** | **4.0** | **1.0** |

Architecture B requires each app to manage subscriptions at multiple source feed endpoints (mean 4 per enrolled patient). In A and C, each app manages a single Broker subscription.

#### Payers

|  | A | B | C |
|--|---|---|---|
| Total subscriptions | 438.2M | **1.40B** | 438.2M |
| Notifications received | 2.98B | 2.67B | 2.98B |
| Annual churn subs | 131.4M | **419.1M** | 131.4M |
| Ghost subscriptions | 0 | **10.2M** | 0 |

Payers are the most affected stakeholder in Architecture B. With 90% population coverage and ~1.28 payers per patient, payers account for 62% of B's direct source subscriptions. Their higher churn rate (2.5% monthly vs. 12% annual for apps) amplifies the control plane burden: **419 million subscription operations per year** in B versus 131 million in A.

At a 5% deactivation failure rate, B accumulates **10.2 million ghost subscriptions** — stale subscriptions at sources that continue generating ~26.7 million wasted notifications per year. These ghost subscriptions also represent a latent privacy risk: notifications flowing to payers who no longer have a relationship with the patient.

---

## 4. Scenario Analysis

The simulation tests four additional scenarios to assess sensitivity to key assumptions.

### 4.1 Mature Adoption (38% app enrollment, up from 20%)

Doubling app enrollment increases B's direct source subscriptions from 1.54B to 1.76B (+14%) and app subscriptions per enrolled patient from 4.0 to 4.5. The per-source burden at p95 grows from 419K to 485K subscriptions. Architecture A's total messages increase modestly (13.1B → 14.4B) since more apps means more fan-out at the network level.

### 4.2 High Fragmentation (mean 2.46 relationships, up from 2.19)

More care fragmentation increases B's direct source subscriptions to 1.78B (+16%) because patients visit more distinct sources. B's payer subscriptions grow disproportionately since each payer must subscribe to every source a patient visits. Architecture A is less sensitive to fragmentation because the source-to-network message count doesn't depend on how many sources a patient has — only on how many events occur.

### 4.3 Cross-Network Mix (more app-provider network divergence)

When apps and providers are spread across more distinct networks, Architecture A generates more network-to-network relay messages. Architecture B is relatively insensitive since its data plane bypasses networks entirely. This scenario is most relevant if the ecosystem evolves toward more specialized app-centric and provider-centric networks.

### 4.4 High Payer Churn (5% monthly churn, 10% deactivation failure)

This stress scenario doubles the monthly payer churn rate and doubles the deactivation failure rate. The results for Architecture B are significant:

- Ghost subscriptions grow from 10.2M to **39.4M** (2.6% of active subscriptions)
- Wasted ghost notifications grow to **103M per year**
- Payer annual churn subscriptions reach **838M** — nearly 2x the payer subscription base

Architecture A absorbs this same churn with 263M subscription operations per year, all handled at the Broker level with no impact on data sources.

---

## 5. Discussion

### 5.1 The Core Tradeoff

Architecture A centralizes complexity at networks, shielding sources and clients from routing and subscription management. The cost is higher total system message volume due to relay overhead, and deeper dependency on network infrastructure for all data flow.

Architecture B distributes complexity to sources and clients, reducing total messages and removing networks from the data path. The cost is massive subscription state at sources (1.5B+), higher per-source operational burden, and a control plane that scales linearly with the number of source-consumer pairs.

Architecture C combines A's routing model with end-to-end encryption, giving networks a relay role without access to notification content. The cost is the highest total message and byte volume of all three, plus the operational complexity of key distribution to every source.

### 5.2 Feasibility Considerations

**Can data sources handle B's subscription burden?** The simulation shows a p95 source managing 419K subscriptions and 3,228 messages/day. Many U.S. provider EHRs today do not support FHIR Subscriptions at all. Requiring them to operate at this scale represents a significant capability gap. Architecture B's spec acknowledges this by allowing network Brokers to host source feed endpoints on behalf of providers who cannot — but this shifts B closer to A's architecture for those sources.

**Is A's relay overhead acceptable?** A generates 2x the data-plane messages of B, but this traffic flows between well-provisioned network nodes, not individual provider EHRs. Networks are purpose-built for high-throughput message routing. The relay overhead is the cost of centralizing operations.

**Can the ecosystem sustain B's control plane at payer scale?** Payers drive 62% of B's source subscriptions and 419M annual churn operations. The high-payer-churn scenario shows this can grow to 838M operations with ghost subscription accumulation. In A, payer churn is handled entirely at the Broker — data sources never see it.

### 5.3 Ghost Subscription Risk

Architecture B is uniquely exposed to deactivation failures. When an app uninstalls or a payer member changes plans, subscriptions must be deactivated at every source the patient visited. In A, a single Broker-level deactivation handles it. In B, each source must be individually notified.

At a conservative 5% failure rate, the baseline scenario shows 10.2M ghost subscriptions generating 26.7M wasted notifications per year. Under high payer churn (5% monthly, 10% failure), this grows to 39.4M ghosts and 103M wasted notifications. Beyond the wasted compute, ghost subscriptions represent a **privacy concern**: clinical data flowing to payers who no longer have a relationship with the patient.

### 5.4 What This Simulation Does Not Model

- **Implementation complexity** — the difficulty of building and maintaining each architecture
- **Latency** — how quickly notifications reach consumers after an event
- **Availability and fault tolerance** — how each architecture degrades under component failure
- **Incremental deployment** — how each architecture handles partial adoption across networks
- **Cost per message** — actual infrastructure costs vary by stakeholder
- **Privacy properties of C beyond message routing** — the end-to-end encryption guarantees of Architecture C may be decisive for some stakeholders regardless of volume metrics

---

## 6. Summary by Stakeholder

### For Data Sources / Providers

Architecture A is the simplest integration. One connection to your network, zero subscription management, no direct client relationships. Architecture B requires operating a subscription platform serving hundreds of thousands of clients. If your EHR cannot support FHIR Subscriptions natively, your network Broker must host a feed endpoint on your behalf.

### For Networks / Brokers

Architecture B places the lightest ongoing operational burden on networks (90% less relay traffic), but requires implementing multiplexed peer subscriptions and new-care-relationship signaling. Architecture A requires networks to handle all notification routing, including fan-out to every client — 10.5B relay messages/year. Architecture C is heaviest, adding key distribution on top of A's relay model.

### For Patient Apps

Architecture A is simplest: one subscription, one connection, one auth context. Architecture B requires managing subscriptions at each source (mean 4 per patient), including authorization at each feed endpoint and catch-up polling. The notification content is similar in both — the complexity difference is in subscription lifecycle management.

### For Payers

Payers face the starkest difference. In Architecture A: 438M subscriptions, all at the Broker level, 131M annual churn operations. In Architecture B: 1.4B subscriptions across Brokers and sources, 419M annual churn operations, and 10.2M ghost subscriptions that risk misdirected PHI. Payers with high member churn (Medicaid, marketplace plans) are most affected.

---

## Appendix: Simulation Parameters

| Parameter | Baseline Value |
|-----------|---------------|
| Sample patients | 120,000 (scaled to 342M) |
| App enrollment rate | 20% |
| App churn (annual) | 12% |
| Payer enrollment rate | 90% |
| Payer churn (monthly) | 2.5% |
| Mean payers per patient | 1.28 |
| Outpatient scheduled multiplier | 1.10 |
| Clinical notification payload | 1,400 bytes |
| Care relationship payload | 700 bytes |
| Subscription create payload | 1,000 bytes |
| Encrypted overhead | 256 bytes |
| Deactivation failure rate (B) | 5% |
| Networks | 11 |
| Provider organizations | 12,000 |

The simulator source and full scenario output are available in `fhir_network_sim.ts` and `fhir_network_sim_results.txt`.
