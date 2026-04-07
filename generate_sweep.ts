import {
  createDefaultConfig,
  buildWorld,
  runAll,
  PROTOCOL_LABELS,
  type SimulationConfig,
} from "./fhir_network_sim";
import {
  extractFromAllResults,
  type ExtractedProtocol,
  type ExtractedProtocolBands,
  type NumericBand,
  type ScenarioBundle,
  type SweepData,
} from "./src/extract";
import {
  SCENARIO_BUNDLES,
  SCENARIO_SAMPLE_PATIENTS,
  SCENARIO_SEEDS,
  SWEEP_ARTIFACT_KIND,
  computeSweepInputHash,
} from "./sweep_meta";

function deepMerge(target: any, source: any): any {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

function summarize(values: number[]): NumericBand {
  if (!values.length) {
    return { p10: 0, p50: 0, p90: 0, mean: 0, min: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  return {
    p10: quantile(sorted, 0.10),
    p50: quantile(sorted, 0.50),
    p90: quantile(sorted, 0.90),
    mean,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function summarizeProtocols(runs: Array<Record<string, ExtractedProtocol>>): {
  protocols: Record<string, ExtractedProtocol>;
  protocolBands: Record<string, ExtractedProtocolBands>;
} {
  const models = ["A", "B", "Bp", "C"] as const;
  const protocols: Record<string, ExtractedProtocol> = {};
  const protocolBands: Record<string, ExtractedProtocolBands> = {};

  for (const model of models) {
    const sample = runs[0][model];
    const point: any = {};
    const bands: any = {};
    for (const key of Object.keys(sample) as Array<keyof ExtractedProtocol>) {
      const summary = summarize(runs.map((run) => run[model][key]));
      point[key] = summary.p50;
      bands[key] = summary;
    }
    protocols[model] = point;
    protocolBands[model] = bands;
  }

  return { protocols, protocolBands };
}

function summarizeWorlds(worlds: any[]): { world: any; worldBands: Record<string, NumericBand> } {
  const sample = worlds[0];
  const world: any = {};
  const worldBands: Record<string, NumericBand> = {};

  for (const [key, value] of Object.entries(sample)) {
    if (typeof value === "number") {
      const summary = summarize(worlds.map((w) => w[key]));
      world[key] = summary.p50;
      worldBands[key] = summary;
    } else {
      // Arrays/labels are deterministic for the current world construction.
      world[key] = value;
    }
  }

  return { world, worldBands };
}

function winnersForMetric(
  protocols: Record<string, ExtractedProtocol>,
  metric: keyof ExtractedProtocol
): Array<"A" | "B" | "Bp" | "C"> {
  const models = ["A", "B", "Bp", "C"] as const;
  const values = models.map((m) => protocols[m][metric]);
  const best = Math.min(...values);
  return models.filter((m) => Math.abs(protocols[m][metric] - best) < 1e-9);
}

function materializeScenarioConfig(base: SimulationConfig, scenarioId: string, seed: number): SimulationConfig {
  const scenario = SCENARIO_BUNDLES.find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`Unknown scenario ${scenarioId}`);

  let cfg = deepMerge(base, scenario.overrides);
  cfg = deepMerge(cfg, {
    seed,
    population: {
      samplePatients: SCENARIO_SAMPLE_PATIENTS,
    },
  });

  if (scenarioId === "high-fragmentation" || scenarioId === "combined-stress") {
    cfg.population.cohorts = base.population.cohorts.map((c) => ({
      ...c,
      fragmentationAlpha: c.fragmentationAlpha + 1.0,
      fragmentationBeta: Math.max(1.5, c.fragmentationBeta - 0.6),
      meanBaselineRelationships: c.meanBaselineRelationships * 1.15,
    }));
  }

  return cfg;
}

function runScenarioBundle(base: SimulationConfig, scenarioId: string): ScenarioBundle {
  const def = SCENARIO_BUNDLES.find((s) => s.id === scenarioId);
  if (!def) throw new Error(`Unknown scenario bundle ${scenarioId}`);

  const results = SCENARIO_SEEDS.map((seed) => {
    const cfg = materializeScenarioConfig(base, scenarioId, seed);
    const allResults = runAll(buildWorld(cfg));
    return {
      world: allResults.world,
      protocols: extractFromAllResults(allResults),
    };
  });

  const worlds = results.map((r) => r.world);
  const protocols = results.map((r) => r.protocols);
  const worldSummary = summarizeWorlds(worlds);
  const protocolSummary = summarizeProtocols(protocols);

  return {
    id: def.id,
    label: def.label,
    description: def.description,
    runs: SCENARIO_SEEDS.length,
    seeds: [...SCENARIO_SEEDS],
    world: worldSummary.world,
    worldBands: worldSummary.worldBands,
    protocols: protocolSummary.protocols as any,
    protocolBands: protocolSummary.protocolBands as any,
    winners: {
      totalMessages: winnersForMetric(protocolSummary.protocols, "totalMessages"),
      srcP95Subs: winnersForMetric(protocolSummary.protocols, "src_p95Subs"),
      payerTotalSubs: winnersForMetric(protocolSummary.protocols, "payer_totalSubs"),
      payerChurn: winnersForMetric(protocolSummary.protocols, "payer_churn"),
    },
  };
}

const base = createDefaultConfig();
const scenarioBundles = SCENARIO_BUNDLES.map((scenario) => runScenarioBundle(base, scenario.id));

const data: SweepData = {
  meta: {
    kind: SWEEP_ARTIFACT_KIND,
    generatedAt: new Date().toISOString(),
    inputHash: computeSweepInputHash(),
    samplePatients: SCENARIO_SAMPLE_PATIENTS,
    seeds: [...SCENARIO_SEEDS],
    bundleCount: scenarioBundles.length,
  },
  scenarios: Object.fromEntries(
    scenarioBundles.map((bundle) => [
      bundle.id,
      {
        world: bundle.world,
        protocols: bundle.protocols,
      },
    ])
  ),
  scenarioBundles,
  labels: PROTOCOL_LABELS,
};

console.log(JSON.stringify(data));
