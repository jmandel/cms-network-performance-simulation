import {
  createDefaultConfig,
  buildWorld,
  runAll,
  PROTOCOL_LABELS,
  type SimulationConfig,
  type AllResults,
  type ProtocolName,
} from "./fhir_network_sim";

function extract(r: AllResults) {
  const out: Record<string, any> = {};
  for (const m of ["A", "B", "Bp", "C"] as const) {
    const p = r.protocols[m];
    out[m] = {
      dataPlaneMessages: p.derived.dataPlaneMessages,
      controlPlaneMessages: p.derived.controlPlaneMessages,
      totalMessages: p.derived.totalAnnualMessages,
      dataPlaneBytes: p.annual.dataPlaneBytes,
      controlPlaneBytes: p.annual.controlPlaneBytes,
      directSourceSubs: p.state.directSourceSubscriptions,
      directSourceSubs_apps: p.state.directSourceSubscriptions_apps,
      directSourceSubs_payers: p.state.directSourceSubscriptions_payers,
      directSourceSubs_providers: p.state.directSourceSubscriptions_providers,
      ghostSubs: p.state.ghostSubscriptions,
      appToNetworkSubs: p.state.appToNetworkSubscriptions,
      payerToNetworkSubs: p.state.payerToNetworkSubscriptions,
      peerInterest: p.state.peerInterestCopies,
      keysAtSources: p.state.keyCopiesAtSources,
      src_meanSubs: p.stakeholders.sources.meanSubsPerSource,
      src_p95Subs: p.stakeholders.sources.p95SubsPerSource,
      src_meanMsgsDay: p.stakeholders.sources.meanMsgsPerSourcePerDay,
      src_p95MsgsDay: p.stakeholders.sources.p95MsgsPerSourcePerDay,
      src_outbound: p.stakeholders.sources.totalOutboundMessages,
      src_auth: p.stakeholders.sources.totalAuthChecks,
      src_subsManaged: p.stakeholders.sources.totalSubscriptionsManaged,
      net_relay: p.stakeholders.networks.totalRelayMessages,
      net_fanout: p.stakeholders.networks.totalFanOutToClients,
      net_routingState: p.stakeholders.networks.totalRoutingState,
      net_peerInterest: p.stakeholders.networks.peerInterestCopies,
      app_totalSubs: p.stakeholders.apps.totalSubscriptions,
      app_notifs: p.stakeholders.apps.totalNotificationsReceived,
      app_subsPerPt: p.stakeholders.apps.meanSubsPerEnrolledPatient,
      payer_totalSubs: p.stakeholders.payers.totalSubscriptions,
      payer_notifs: p.stakeholders.payers.totalNotificationsReceived,
      payer_churn: p.stakeholders.payers.annualChurnSubscriptions,
      payer_ghost: p.stakeholders.payers.ghostSubscriptions,
      payer_ghostNotifs: p.stakeholders.payers.ghostNotificationsWasted,
      meanDailyMessages: p.derived.meanDailyMessages,
      p95DailyMessages: p.derived.p95DailyMessages,
    };
  }
  return out;
}

function runWith(base: SimulationConfig, overrides: Partial<SimulationConfig>): AllResults {
  const cfg = deepMerge(base, overrides);
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

const base = createDefaultConfig();
// Use fewer patients for sweep points (relative comparisons, not absolute precision)
const sweepBase = { ...base, population: { ...base.population, samplePatients: 30_000 } };
const data: any = { scenarios: {}, sweeps: {} };

// Scenarios
const scenarios: [string, Partial<SimulationConfig>][] = [
  ["baseline", {}],
  ["mature-adoption", { population: { appEnrollmentRate: 0.38, meanExtraAppsIfEnrolled: 0.40 } } as any],
  ["high-fragmentation", {
    population: {
      cohorts: base.population.cohorts.map(c => ({
        ...c,
        fragmentationAlpha: c.fragmentationAlpha + 1.0,
        fragmentationBeta: Math.max(1.5, c.fragmentationBeta - 0.6),
        meanBaselineRelationships: c.meanBaselineRelationships * 1.15,
      }))
    }
  } as any],
  ["cross-network-mix", {
    networks: {
      sameNetworkAppProbability: 0.15,
      multiAppSameNetworkProbability: 0.55,
      newRelationshipExistingNetworkProbability: 0.38,
      homeProviderNetworkProbability: 0.45,
    }
  } as any],
  ["high-payer-churn", {
    payers: { monthlyMemberChurnRate: 0.05 },
    modelB: { deactivationFailureRate: 0.10 },
  } as any],
];

for (const [name, overrides] of scenarios) {
  const r = runWith(base, overrides);
  data.scenarios[name] = {
    world: r.world,
    protocols: extract(r),
  };
}

// Sweeps
// 1. App enrollment rate
data.sweeps.appEnrollment = [];
for (const rate of [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.60]) {
  const r = runWith(sweepBase, { population: { appEnrollmentRate: rate } } as any);
  data.sweeps.appEnrollment.push({ param: rate, label: `${(rate * 100).toFixed(0)}%`, ...extract(r) });
}

// 2. Payer monthly churn
data.sweeps.payerChurn = [];
for (const rate of [0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05, 0.07, 0.10]) {
  const r = runWith(sweepBase, { payers: { monthlyMemberChurnRate: rate } } as any);
  data.sweeps.payerChurn.push({ param: rate, label: `${(rate * 100).toFixed(1)}%/mo`, ...extract(r) });
}

// 3. Deactivation failure rate
data.sweeps.deactivationFailure = [];
for (const rate of [0.0, 0.01, 0.02, 0.05, 0.10, 0.15, 0.20, 0.30]) {
  const r = runWith(sweepBase, { modelB: { deactivationFailureRate: rate } } as any);
  data.sweeps.deactivationFailure.push({ param: rate, label: `${(rate * 100).toFixed(0)}%`, ...extract(r) });
}

// 4. Mean relationships (via fragmentation tuning)
data.sweeps.relationships = [];
for (const mult of [0.6, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0]) {
  const cohorts = base.population.cohorts.map(c => ({
    ...c,
    meanBaselineRelationships: c.meanBaselineRelationships * mult,
  }));
  const r = runWith(sweepBase, { population: { cohorts } } as any);
  const meanRels = r.world.meanRelationshipsPerPatient;
  data.sweeps.relationships.push({ param: mult, label: `${meanRels.toFixed(1)} rels`, meanRels, ...extract(r) });
}

// 5. Number of payers
data.sweeps.payerCount = [];
for (const count of [5, 10, 15, 20, 30, 50]) {
  const r = runWith(sweepBase, { payers: { totalPayers: count } } as any);
  data.sweeps.payerCount.push({ param: count, label: `${count}`, ...extract(r) });
}

// 6. Payer enrollment rate
data.sweeps.payerEnrollment = [];
for (const rate of [0.3, 0.5, 0.7, 0.9, 0.95]) {
  const r = runWith(sweepBase, { payers: { enrollmentRate: rate } } as any);
  data.sweeps.payerEnrollment.push({ param: rate, label: `${(rate * 100).toFixed(0)}%`, ...extract(r) });
}

data.labels = PROTOCOL_LABELS;
console.log(JSON.stringify(data));
