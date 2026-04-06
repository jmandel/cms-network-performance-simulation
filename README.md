# CMS Network Performance Simulation

A single-file TypeScript simulator comparing four FHIR notification architectures at U.S. scale (~342M population), with an interactive HTML report.

**[View the report](https://jmandel.github.io/cms-network-performance-simulation/)**

## Architectures compared

| Label | Description |
|-------|-------------|
| **Broker** | Clients subscribe at their network's Broker. Events relay through networks. Sources have one connection. |
| **Direct** | Clients subscribe directly at each source per patient. Networks handle only new-care signals. |
| **Direct+Group** | Like Direct, but payers use Group-based subscriptions (DaVinci ATR) instead of per-patient subs. |
| **Encrypted** | Same routing as Broker, but with end-to-end encryption. Key distribution adds overhead. |

## What the simulator produces

- Annual message volume (data plane + control plane, separated)
- Subscription and routing state across all stakeholders
- Per-source burden (mean/p95 subscriptions and messages per provider)
- Per-stakeholder analysis (sources, networks, apps, payers)
- Ghost subscription risk (failed deactivation accumulation)
- Sensitivity analysis across 6 parameters

## Running locally

```bash
# Run the simulation (text output)
bun fhir_network_sim.ts

# Build the interactive report
bun install
bun run build.ts
# -> dist/index.html (self-contained, ~600KB)

# Serve locally
bunx serve dist
```

## Files

- `fhir_network_sim.ts` — the full simulator (single file, no dependencies)
- `sim_browser.ts` — browser entry point exposing sim functions on `globalThis`
- `generate_sweep.ts` — generates parameter sweep data for sensitivity analysis
- `build.ts` — builds `dist/index.html` with d3, sim, and sweep data inlined
- `report.html` — report template (uses CDN d3 for local dev)

## Interactive explorer

The report includes an Explorer tab that runs the full simulator in your browser (~65KB bundled). Adjust parameters with sliders and see results instantly.
