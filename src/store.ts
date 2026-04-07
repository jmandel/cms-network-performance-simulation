import { create } from "zustand";
import type { ModelId } from "./constants";
import type { ExtractedProtocol, SweepData } from "./extract";
import { extractFromAllResults } from "./extract";
import { createDefaultConfig, buildWorld, runAll } from "../fhir_network_sim";
import type { SimulationConfig } from "../fhir_network_sim";

interface Sliders {
  appEnrollmentRate: number;
  payerEnrollmentRate: number;
  payerMonthlyChurn: number;
  appAnnualChurn: number;
  deactivationFailure: number;
  relationshipMult: number;
  samplePatients: number;
}

interface ReportStore {
  sweepData: SweepData | null;
  baseline: Record<ModelId, ExtractedProtocol> | null;
  baselineWorld: any | null;

  sliders: Sliders;
  explorerResults: Record<ModelId, ExtractedProtocol> | null;
  explorerWorld: any | null;
  isSimRunning: boolean;
  simStatus: string;

  tooltip: { html: string; x: number; y: number } | null;

  init: () => void;
  setSlider: <K extends keyof Sliders>(key: K, value: Sliders[K]) => void;
  runSimulation: () => void;
  showTooltip: (html: string, x: number, y: number) => void;
  hideTooltip: () => void;
}

export const useStore = create<ReportStore>((set, get) => ({
  sweepData: null,
  baseline: null,
  baselineWorld: null,

  sliders: {
    appEnrollmentRate: 0.2,
    payerEnrollmentRate: 0.9,
    payerMonthlyChurn: 0.025,
    appAnnualChurn: 0.12,
    deactivationFailure: 0.05,
    relationshipMult: 1.0,
    samplePatients: 20000,
  },
  explorerResults: null,
  explorerWorld: null,
  isSimRunning: false,
  simStatus: "Loading...",

  tooltip: null,

  init: () => {
    const data = (window as any).__SWEEP_DATA__ as SweepData;
    if (data) {
      set({
        sweepData: data,
        baseline: data.scenarios.baseline.protocols,
        baselineWorld: data.scenarios.baseline.world,
      });
    }
    // Auto-run explorer with defaults
    setTimeout(() => get().runSimulation(), 0);
  },

  setSlider: (key, value) =>
    set((s) => ({ sliders: { ...s.sliders, [key]: value } })),

  runSimulation: () => {
    set({ isSimRunning: true, simStatus: "Running..." });
    setTimeout(() => {
      try {
        const { sliders } = get();
        const base = createDefaultConfig();
        const cohorts = base.population.cohorts.map((c) => ({
          ...c,
          meanBaselineRelationships:
            c.meanBaselineRelationships * sliders.relationshipMult,
        }));
        const cfg = deepMerge(base, {
          population: {
            samplePatients: Math.round(sliders.samplePatients),
            appEnrollmentRate: sliders.appEnrollmentRate,
            annualAppChurnRate: sliders.appAnnualChurn,
            cohorts,
          },
          payers: {
            enrollmentRate: sliders.payerEnrollmentRate,
            monthlyMemberChurnRate: sliders.payerMonthlyChurn,
          },
          modelB: {
            deactivationFailureRate: sliders.deactivationFailure,
          },
        });
        const world = buildWorld(cfg);
        const results = runAll(world);
        set({
          explorerResults: extractFromAllResults(results),
          explorerWorld: results.world,
          isSimRunning: false,
          simStatus: `Done (${Math.round(sliders.samplePatients).toLocaleString()} patients → ${Math.round(results.world.weightedPopulation).toLocaleString()})`,
        });
      } catch (e: any) {
        set({ isSimRunning: false, simStatus: "Error: " + e.message });
      }
    }, 50);
  },

  showTooltip: (html, x, y) => set({ tooltip: { html, x, y } }),
  hideTooltip: () => set({ tooltip: null }),
}));

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
