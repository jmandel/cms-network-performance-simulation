/**
 * Browser entry point — exposes sim functions on globalThis.
 */
import {
  createDefaultConfig,
  buildWorld,
  runAll,
  type SimulationConfig,
  type AllResults,
} from "./fhir_network_sim";

function runSimulation(configOverrides?: any): AllResults {
  const base = createDefaultConfig();
  const cfg = configOverrides ? deepMerge(base, configOverrides) : base;
  const world = buildWorld(cfg);
  return runAll(world);
}

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

(globalThis as any).Sim = {
  createDefaultConfig,
  buildWorld,
  runAll,
  runSimulation,
  deepMerge,
};
