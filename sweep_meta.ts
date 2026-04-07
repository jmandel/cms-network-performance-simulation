import { createHash } from "crypto";
import { readFileSync } from "fs";
import type { SimulationConfig } from "./fhir_network_sim";

export interface ScenarioBundleDef {
  id: string;
  label: string;
  description: string;
  overrides: Partial<SimulationConfig>;
}

export const SCENARIO_SAMPLE_PATIENTS = 30_000;
export const SCENARIO_SEEDS = [11, 23, 37, 41, 53];
export const SWEEP_ARTIFACT_KIND = "scenario-bundles-v2";

export const SCENARIO_BUNDLES: ScenarioBundleDef[] = [
  {
    id: "baseline",
    label: "Baseline",
    description: "Current source-backed defaults with payer and patient access both in scope.",
    overrides: {},
  },
  {
    id: "patient-growth",
    label: "Patient Growth",
    description: "Higher patient-app uptake and more multi-app behavior.",
    overrides: {
      population: {
        appEnrollmentRate: 0.20,
        meanExtraAppsIfEnrolled: 0.20,
      } as any,
    },
  },
  {
    id: "payer-heavy",
    label: "Payer Heavy",
    description: "Broader payer coverage and more multi-coverage per patient.",
    overrides: {
      payers: {
        enrollmentRate: 0.97,
        meanPayersPerPatient: 1.18,
        monthlyMemberChurnRate: 0.015,
      } as any,
    },
  },
  {
    id: "high-fragmentation",
    label: "High Fragmentation",
    description: "Patients accumulate more distinct provider relationships over time.",
    overrides: {},
  },
  {
    id: "cross-network-mix",
    label: "Cross-Network Mix",
    description: "Apps and providers diverge across more network boundaries.",
    overrides: {
      networks: {
        sameNetworkAppProbability: 0.15,
        multiAppSameNetworkProbability: 0.55,
        newRelationshipExistingNetworkProbability: 0.38,
        homeProviderNetworkProbability: 0.45,
      } as any,
    },
  },
  {
    id: "high-payer-churn",
    label: "High Payer Churn",
    description: "Higher member churn and more failed deactivations.",
    overrides: {
      payers: {
        monthlyMemberChurnRate: 0.05,
      } as any,
      modelB: {
        deactivationFailureRate: 0.10,
      } as any,
    },
  },
  {
    id: "combined-stress",
    label: "Combined Stress",
    description: "Higher app uptake, payer churn, and fragmentation at the same time.",
    overrides: {
      population: {
        appEnrollmentRate: 0.20,
        meanExtraAppsIfEnrolled: 0.20,
      } as any,
      payers: {
        monthlyMemberChurnRate: 0.05,
      } as any,
      modelB: {
        deactivationFailureRate: 0.10,
      } as any,
    },
  },
  {
    id: "low-adoption",
    label: "Low Adoption",
    description: "Conservative rollout with lower app and payer participation.",
    overrides: {
      population: {
        appEnrollmentRate: 0.04,
        meanExtraAppsIfEnrolled: 0.05,
      } as any,
      payers: {
        enrollmentRate: 0.80,
        meanPayersPerPatient: 0.95,
        monthlyMemberChurnRate: 0.008,
      } as any,
    },
  },
  {
    id: "c-encryption-stress",
    label: "Encryption Stress",
    description: "Endpoint encryption with broad key propagation to stress Proposal C.",
    overrides: {
      modelC: {
        encryptionMode: "endpoint",
        keyPropagationMode: "all-sources-in-peer-networks",
      } as any,
    },
  },
];

export function computeSweepInputHash(): string {
  const hash = createHash("sha256");
  for (const path of ["fhir_network_sim.ts", "generate_sweep.ts", "sweep_meta.ts"]) {
    hash.update(path);
    hash.update("\n");
    hash.update(readFileSync(path, "utf8"));
    hash.update("\n");
  }
  return hash.digest("hex");
}
