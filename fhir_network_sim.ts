
/**
 * TEFCA-like FHIR subscription ecosystem simulator.
 *
 * Purpose:
 *   - Generate one synthetic TEFCA-like ecosystem at U.S. scale.
 *   - Run the same synthetic world through three protocol designs:
 *       A. Subscriptions Broker (network-routed)
 *       B. Relationship Feed + Source Feed (per-source direct)
 *       C. Encrypted Relay
 *   - Compare control-plane load, data-plane load, state size, per-source
 *     burden, and per-stakeholder operational metrics.
 *
 * Run:
 *   npx ts-node fhir_network_sim.ts
 *
 * No external dependencies.
 */

declare const require: any;
declare const module: any;

type ProtocolName = "A" | "B" | "Bp" | "C";
const PROTOCOL_LABELS: Record<ProtocolName, string> = {
  A: "Broker",
  B: "Direct",
  Bp: "Direct+Group",
  C: "Encrypted",
};
type EpisodeType = "outpatient" | "ed" | "inpatient";
type NetworkArchetype = "provider" | "balanced" | "app";
type EncryptionMode = "recipient-category" | "endpoint";
type KeyPropagationMode = "active-sources-only" | "all-sources-in-peer-networks";

interface CohortConfig {
  name: string;
  share: number;
  meanOutpatientEpisodes: number;
  meanEdEpisodes: number;
  meanInpatientAdmissions: number;
  meanBaselineRelationships: number;
  fragmentationAlpha: number;
  fragmentationBeta: number;
  primaryCareTeamProbability: number;
  additionalCareTeamProbability: number;
  newRelationshipCareTeamProbability: number;
  appEnrollmentMultiplier: number;
}

interface PopulationConfig {
  usPopulation: number;
  samplePatients: number;
  utilizationSigma: number;
  appEnrollmentRate: number;
  meanExtraAppsIfEnrolled: number;
  maxAppsPerPatient: number;
  annualAppChurnRate: number;
  cohorts: CohortConfig[];
}

interface NetworkConfig {
  count: number;
  zipfExponent: number;
  rankArchetypes: NetworkArchetype[];
  sameNetworkAppProbability: number;
  multiAppSameNetworkProbability: number;
  newRelationshipExistingNetworkProbability: number;
  homeProviderNetworkProbability: number;
  providerCapableNetworkFraction: number;
}

interface SourceConfig {
  totalOrganizations: number;
  orgSizeSigma: number;
  maxRelationshipsPerPatient: number;
  sourceSelectionStickiness: number;
}

interface AppVendorConfig {
  totalVendors: number;
  vendorPopularitySigma: number;
}

interface PayerConfig {
  totalPayers: number;
  payerSizeSigma: number;
  enrollmentRate: number;
  meanPayersPerPatient: number;
  monthlyMemberChurnRate: number;
}

interface EventConfig {
  outpatientScheduledMultiplier: number;
  outpatientCompletedNotifications: number;
  edNotifications: number;
  inpatientAdmissionNotifications: number;
  inpatientDischargeNotifications: number;
  payloadBytes: {
    clinicalNotification: number;
    careRelationshipNotification: number;
    appSubscriptionCreate: number;
    appSubscriptionDelete: number;
    interestPropagation: number;
    publicKeyPropagation: number;
    providerInterestRegistration: number;
  };
  encryptedOverheadBytes: number;
  dailyOverdispersionK: number;
}

interface ConsumerConfig {
  providerConsumersEnabled: boolean;
  providerCareTeamIntensity: number;
}

interface ModelAConfig {
  propagateInterestToAllProviderNetworks: boolean;
}

interface ModelBConfig {
  deliverClinicalEventOnNewRelationship: boolean;
  deactivationFailureRate: number;
}

interface ModelCConfig {
  encryptionMode: EncryptionMode;
  keyPropagationMode: KeyPropagationMode;
}

interface SimulationConfig {
  seed: number;
  population: PopulationConfig;
  networks: NetworkConfig;
  sources: SourceConfig;
  apps: AppVendorConfig;
  payers: PayerConfig;
  events: EventConfig;
  consumers: ConsumerConfig;
  modelA: ModelAConfig;
  modelB: ModelBConfig;
  modelC: ModelCConfig;
}

interface Network {
  id: number;
  name: string;
  rank: number;
  archetype: NetworkArchetype;
  sizeWeight: number;
  providerWeight: number;
  appWeight: number;
}

interface ProviderOrg {
  id: number;
  networkId: number;
  weight: number;
  name: string;
}

interface AppVendor {
  id: number;
  networkId: number;
  weight: number;
  name: string;
}

interface Payer {
  id: number;
  networkId: number;
  weight: number;
  name: string;
}

interface Relationship {
  id: number;
  orgId: number;
  networkId: number;
  isBaseline: boolean;
  isCareTeam: boolean;
  touches: number;
}

interface AppEndpoint {
  vendorId: number;
  networkId: number;
}

interface PayerEndpoint {
  payerId: number;
  networkId: number;
}

interface Episode {
  type: EpisodeType;
  sourceRelationshipId: number;
  sourceOrgId: number;
  sourceNetworkId: number;
  isNewRelationship: boolean;
  patientAppNetworks: number[];
  patientAppCount: number;
  patientPayerNetworks: number[];
  patientPayerCount: number;
  providerRecipientRelationshipIds: number[];
  providerRecipientNetworks: number[];
  providerRecipientCount: number;
  clinicalNotificationCopies: number;
}

interface Patient {
  id: number;
  weight: number;
  cohortName: string;
  utilizationMultiplier: number;
  fragmentation: number;
  homeProviderNetworkId: number;
  appEndpoints: AppEndpoint[];
  payerEndpoints: PayerEndpoint[];
  relationships: Relationship[];
  baselineRelationshipCount: number;
  newRelationshipCount: number;
  episodes: Episode[];
  totalNotifications: number;
  distinctProviderNetworks: number;
}

interface SyntheticWorld {
  config: SimulationConfig;
  networks: Network[];
  providerOrgs: ProviderOrg[];
  appVendors: AppVendor[];
  payers: Payer[];
  patients: Patient[];
  summary: WorldSummary;
}

interface WorldSummary {
  weightedPopulation: number;
  meanAppsPerPatient: number;
  meanAppsPerEnrolledPatient: number;
  enrolledPatientRate: number;
  meanPayersPerPatient: number;
  payerEnrollmentRate: number;
  meanRelationshipsPerPatient: number;
  p50Relationships: number;
  p95Relationships: number;
  meanDistinctProviderNetworksPerPatient: number;
  meanEpisodesPerPatient: number;
  top5PctPatientShareOfEpisodes: number;
  providerNetworkShares: Array<{ network: string; share: number; archetype: NetworkArchetype }>;
  appNetworkShares: Array<{ network: string; share: number; archetype: NetworkArchetype }>;
}

interface PerSourceStats {
  subscriptions: number;
  annualOutboundMessages: number;
  annualAuthChecks: number;
}

interface StakeholderBurden {
  sources: {
    totalOutboundMessages: number;
    totalAuthChecks: number;
    totalSubscriptionsManaged: number;
    meanSubsPerSource: number;
    p95SubsPerSource: number;
    meanMsgsPerSourcePerDay: number;
    p95MsgsPerSourcePerDay: number;
  };
  networks: {
    totalRelayMessages: number;
    totalRoutingState: number;
    peerInterestCopies: number;
    totalFanOutToClients: number;
  };
  apps: {
    totalSubscriptions: number;
    totalNotificationsReceived: number;
    meanSubsPerEnrolledPatient: number;
  };
  payers: {
    totalSubscriptions: number;
    totalNotificationsReceived: number;
    annualChurnSubscriptions: number;
    ghostSubscriptions: number;
    ghostNotificationsWasted: number;
  };
}

interface ProtocolResult {
  model: ProtocolName;
  description: string;
  annual: {
    clinicalEventsObserved: number;
    newCareSignalsObserved: number;
    sourceToNetworkMessages: number;
    sourceToConsumerMessages: number;
    networkToNetworkMessages: number;
    networkToConsumerMessages: number;
    controlPlaneMessages: number;
    dataPlaneBytes: number;
    controlPlaneBytes: number;
    sourceAuthChecks: number;
    networkRoutingChecks: number;
    encryptionOperations: number;
    decryptionOperations: number;
  };
  state: {
    appToNetworkSubscriptions: number;
    payerToNetworkSubscriptions: number;
    providerInterestRegistrations: number;
    peerInterestCopies: number;
    directSourceSubscriptions: number;
    directSourceSubscriptions_apps: number;
    directSourceSubscriptions_payers: number;
    directSourceSubscriptions_providers: number;
    ghostSubscriptions: number;
    keyCopiesAtNetworks: number;
    keyCopiesAtSources: number;
  };
  derived: {
    totalAnnualMessages: number;
    dataPlaneMessages: number;
    controlPlaneMessages: number;
    meanDailyMessages: number;
    p95DailyMessages: number;
  };
  stakeholders: StakeholderBurden;
}

interface AllResults {
  world: WorldSummary;
  protocols: Record<ProtocolName, ProtocolResult>;
}

class RNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    // mulberry32
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  bool(p: number): boolean {
    return this.next() < p;
  }

  normal(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  logNormal(mu: number, sigma: number): number {
    return Math.exp(mu + sigma * this.normal());
  }

  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    if (lambda < 30) {
      const L = Math.exp(-lambda);
      let p = 1;
      let k = 0;
      while (p > L) {
        k++;
        p *= this.next();
      }
      return k - 1;
    }
    // normal approximation for larger lambda
    const x = Math.round(lambda + Math.sqrt(lambda) * this.normal());
    return Math.max(0, x);
  }

  gamma(shape: number, scale = 1): number {
    if (shape <= 0) return 0;
    if (shape < 1) {
      const u = this.next();
      return this.gamma(1 + shape, scale) * Math.pow(u, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x = this.normal();
      let v = 1 + c * x;
      if (v <= 0) continue;
      v = v * v * v;
      const u = this.next();
      if (u < 1 - 0.0331 * x * x * x * x) return scale * d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return scale * d * v;
    }
  }

  beta(alpha: number, beta: number): number {
    const x = this.gamma(alpha, 1);
    const y = this.gamma(beta, 1);
    return x / (x + y);
  }

  choiceWeighted(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    const target = this.next() * total;
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (target <= acc) return i;
    }
    return weights.length - 1;
  }

  shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

function createDefaultConfig(): SimulationConfig {
  return {
    seed: 42,
    population: {
      // U.S. population clock, Apr 6 2026
      usPopulation: 342_415_247,
      samplePatients: 120_000,
      utilizationSigma: 1.0,
      // Deliberately below current portal/app usage to reflect an MVP/near-term
      // subscription program rather than the upper bound of all record access.
      appEnrollmentRate: 0.20,
      meanExtraAppsIfEnrolled: 0.22,
      maxAppsPerPatient: 4,
      annualAppChurnRate: 0.12,
      cohorts: [
        {
          name: "child",
          share: 0.215,
          meanOutpatientEpisodes: 2.5,
          meanEdEpisodes: 0.25,
          meanInpatientAdmissions: 0.03,
          meanBaselineRelationships: 1.10,
          fragmentationAlpha: 2.8,
          fragmentationBeta: 3.2,
          primaryCareTeamProbability: 0.30,
          additionalCareTeamProbability: 0.08,
          newRelationshipCareTeamProbability: 0.05,
          appEnrollmentMultiplier: 0.8,
        },
        {
          name: "adult",
          share: 0.605,
          meanOutpatientEpisodes: 2.7,
          meanEdEpisodes: 0.45,
          meanInpatientAdmissions: 0.09,
          meanBaselineRelationships: 1.55,
          fragmentationAlpha: 3.4,
          fragmentationBeta: 2.8,
          primaryCareTeamProbability: 0.40,
          additionalCareTeamProbability: 0.10,
          newRelationshipCareTeamProbability: 0.07,
          appEnrollmentMultiplier: 1.0,
        },
        {
          name: "senior",
          share: 0.18,
          meanOutpatientEpisodes: 4.2,
          meanEdEpisodes: 0.72,
          meanInpatientAdmissions: 0.24,
          meanBaselineRelationships: 2.45,
          fragmentationAlpha: 4.1,
          fragmentationBeta: 2.4,
          primaryCareTeamProbability: 0.62,
          additionalCareTeamProbability: 0.14,
          newRelationshipCareTeamProbability: 0.09,
          appEnrollmentMultiplier: 1.2,
        },
      ],
    },
    networks: {
      count: 11,
      zipfExponent: 0.78,
      rankArchetypes: [
        "provider",
        "provider",
        "provider",
        "provider",
        "balanced",
        "balanced",
        "balanced",
        "app",
        "app",
        "app",
        "app",
      ],
      sameNetworkAppProbability: 0.28,
      multiAppSameNetworkProbability: 0.72,
      newRelationshipExistingNetworkProbability: 0.62,
      homeProviderNetworkProbability: 0.70,
      providerCapableNetworkFraction: 1.0,
    },
    sources: {
      totalOrganizations: 12_000,
      orgSizeSigma: 1.05,
      maxRelationshipsPerPatient: 40,
      sourceSelectionStickiness: 1.35,
    },
    apps: {
      totalVendors: 80,
      vendorPopularitySigma: 1.15,
    },
    payers: {
      totalPayers: 15,
      payerSizeSigma: 0.95,
      enrollmentRate: 0.90,
      meanPayersPerPatient: 1.08,
      monthlyMemberChurnRate: 0.025,
    },
    events: {
      outpatientScheduledMultiplier: 1.10,
      outpatientCompletedNotifications: 1,
      edNotifications: 1,
      inpatientAdmissionNotifications: 1,
      inpatientDischargeNotifications: 1,
      payloadBytes: {
        clinicalNotification: 1400,
        careRelationshipNotification: 700,
        appSubscriptionCreate: 1000,
        appSubscriptionDelete: 700,
        interestPropagation: 350,
        publicKeyPropagation: 800,
        providerInterestRegistration: 500,
      },
      encryptedOverheadBytes: 256,
      dailyOverdispersionK: 20000,
    },
    consumers: {
      providerConsumersEnabled: true,
      providerCareTeamIntensity: 1.0,
    },
    modelA: {
      propagateInterestToAllProviderNetworks: true,
    },
    modelB: {
      deliverClinicalEventOnNewRelationship: false,
      deactivationFailureRate: 0.05,
    },
    modelC: {
      encryptionMode: "recipient-category",
      keyPropagationMode: "active-sources-only",
    },
  };
}

function normalize(weights: number[]): number[] {
  const s = weights.reduce((a, b) => a + b, 0);
  return weights.map((x) => x / s);
}

function zipfWeights(count: number, exponent: number): number[] {
  const weights = Array.from({ length: count }, (_, i) => 1 / Math.pow(i + 1, exponent));
  return normalize(weights);
}

function archetypeAffinities(archetype: NetworkArchetype): { provider: number; app: number } {
  switch (archetype) {
    case "provider":
      return { provider: 1.25, app: 0.55 };
    case "balanced":
      return { provider: 0.95, app: 0.95 };
    case "app":
      return { provider: 0.45, app: 1.35 };
  }
}

function largestRemainderAllocation(total: number, shares: number[]): number[] {
  const raw = shares.map((x) => x * total);
  const floor = raw.map(Math.floor);
  let remainder = total - floor.reduce((a, b) => a + b, 0);
  const frac = raw.map((x, i) => ({ i, frac: x - floor[i] })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) {
    floor[frac[k % frac.length].i] += 1;
  }
  return floor;
}

function uniquePush<T>(arr: T[], value: T): void {
  if (!arr.includes(value)) arr.push(value);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[idx];
}

function formatInt(x: number): string {
  return Math.round(x).toLocaleString("en-US");
}

function formatPct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

function bytesToGiB(bytes: number): string {
  const gib = bytes / (1024 ** 3);
  return `${gib.toFixed(1)} GiB`;
}

function createNetworks(config: SimulationConfig): Network[] {
  const base = zipfWeights(config.networks.count, config.networks.zipfExponent);
  const networks: Network[] = [];
  for (let i = 0; i < config.networks.count; i++) {
    const archetype = config.networks.rankArchetypes[i] ?? "balanced";
    const affinity = archetypeAffinities(archetype);
    networks.push({
      id: i,
      name: `Net-${i + 1}`,
      rank: i + 1,
      archetype,
      sizeWeight: base[i],
      providerWeight: base[i] * affinity.provider,
      appWeight: base[i] * affinity.app,
    });
  }
  const providerNorm = normalize(networks.map((n) => n.providerWeight));
  const appNorm = normalize(networks.map((n) => n.appWeight));
  networks.forEach((n, i) => {
    n.providerWeight = providerNorm[i];
    n.appWeight = appNorm[i];
  });
  return networks;
}

function createProviderOrgs(config: SimulationConfig, networks: Network[], rng: RNG): ProviderOrg[] {
  const counts = largestRemainderAllocation(config.sources.totalOrganizations, networks.map((n) => n.providerWeight));
  const orgs: ProviderOrg[] = [];
  let id = 0;
  counts.forEach((count, networkId) => {
    for (let i = 0; i < count; i++) {
      const weight = rng.logNormal(-0.5 * config.sources.orgSizeSigma ** 2, config.sources.orgSizeSigma);
      orgs.push({
        id,
        networkId,
        weight,
        name: `Org-${id + 1}`,
      });
      id += 1;
    }
  });
  return orgs;
}

function createAppVendors(config: SimulationConfig, networks: Network[], rng: RNG): AppVendor[] {
  const counts = largestRemainderAllocation(config.apps.totalVendors, networks.map((n) => n.appWeight));
  const apps: AppVendor[] = [];
  let id = 0;
  counts.forEach((count, networkId) => {
    for (let i = 0; i < count; i++) {
      const weight = rng.logNormal(-0.5 * config.apps.vendorPopularitySigma ** 2, config.apps.vendorPopularitySigma);
      apps.push({
        id,
        networkId,
        weight,
        name: `App-${id + 1}`,
      });
      id += 1;
    }
  });
  return apps;
}

function createPayers(config: SimulationConfig, networks: Network[], rng: RNG): Payer[] {
  // Distribute payers across networks weighted by overall network size
  const networkWeights = networks.map((n) => n.sizeWeight);
  const counts = largestRemainderAllocation(config.payers.totalPayers, networkWeights);
  const payers: Payer[] = [];
  let id = 0;
  counts.forEach((count, networkId) => {
    for (let i = 0; i < count; i++) {
      const weight = rng.logNormal(-0.5 * config.payers.payerSizeSigma ** 2, config.payers.payerSizeSigma);
      payers.push({
        id,
        networkId,
        weight,
        name: `Payer-${id + 1}`,
      });
      id += 1;
    }
  });
  return payers;
}

function groupedWeights<T extends { networkId: number; weight: number }>(items: T[], networkCount: number): { byNetwork: T[][]; weightsByNetwork: number[][] } {
  const byNetwork: T[][] = Array.from({ length: networkCount }, () => []);
  items.forEach((item) => byNetwork[item.networkId].push(item));
  const weightsByNetwork = byNetwork.map((group) => group.map((x) => x.weight));
  return { byNetwork, weightsByNetwork };
}

function chooseOrgInNetwork(
  rng: RNG,
  byNetwork: ProviderOrg[][],
  weightsByNetwork: number[][],
  networkId: number,
  excludeOrgIds: Set<number>
): ProviderOrg {
  const group = byNetwork[networkId];
  const weights = weightsByNetwork[networkId];
  if (!group.length) {
    throw new Error(`No provider orgs in network ${networkId}`);
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    const idx = rng.choiceWeighted(weights);
    const candidate = group[idx];
    if (!excludeOrgIds.has(candidate.id)) return candidate;
  }
  for (const candidate of group) {
    if (!excludeOrgIds.has(candidate.id)) return candidate;
  }
  return group[group.length - 1];
}

function chooseAppInNetwork(
  rng: RNG,
  byNetwork: AppVendor[][],
  weightsByNetwork: number[][],
  networkId: number,
  excludeVendorIds: Set<number>
): AppVendor {
  const group = byNetwork[networkId];
  const weights = weightsByNetwork[networkId];
  if (!group.length) {
    throw new Error(`No app vendors in network ${networkId}`);
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const idx = rng.choiceWeighted(weights);
    const candidate = group[idx];
    if (!excludeVendorIds.has(candidate.id)) return candidate;
  }
  for (const candidate of group) {
    if (!excludeVendorIds.has(candidate.id)) return candidate;
  }
  return group[group.length - 1];
}

function chooseCohort(rng: RNG, cohorts: CohortConfig[]): CohortConfig {
  return cohorts[rng.choiceWeighted(cohorts.map((c) => c.share))];
}

function buildPatient(
  patientId: number,
  config: SimulationConfig,
  networks: Network[],
  providerOrgs: ProviderOrg[],
  appVendors: AppVendor[],
  payersList: Payer[],
  providerOrgsGrouped: { byNetwork: ProviderOrg[][]; weightsByNetwork: number[][] },
  appVendorsGrouped: { byNetwork: AppVendor[][]; weightsByNetwork: number[][] },
  payersGrouped: { byNetwork: Payer[][]; weightsByNetwork: number[][] },
  rng: RNG
): Patient {
  const cohort = chooseCohort(rng, config.population.cohorts);
  const weight = config.population.usPopulation / config.population.samplePatients;
  const util = rng.logNormal(-0.5 * config.population.utilizationSigma ** 2, config.population.utilizationSigma);
  const fragmentation = rng.beta(cohort.fragmentationAlpha, cohort.fragmentationBeta);

  const providerNetworkWeights = networks.map((n) => n.providerWeight);
  const appNetworkWeights = networks.map((n) => n.appWeight);
  const homeProviderNetworkId = rng.choiceWeighted(providerNetworkWeights);

  const relationshipSet = new Set<number>();
  const relationships: Relationship[] = [];
  let relationshipIdCounter = 0;

  const baselineMean = Math.min(
    config.sources.maxRelationshipsPerPatient,
    cohort.meanBaselineRelationships * Math.pow(util, 0.65)
  );
  const baselineRelationshipCount = Math.min(
    config.sources.maxRelationshipsPerPatient,
    rng.poisson(baselineMean)
  );

  function addRelationship(isBaseline: boolean, preferredNetworkIds: number[]): Relationship {
    let networkId: number;
    if (preferredNetworkIds.length > 0 && rng.bool(config.networks.newRelationshipExistingNetworkProbability)) {
      const weights = preferredNetworkIds.map((id) => {
        const touches = relationships.filter((r) => r.networkId === id).reduce((s, r) => s + Math.max(1, r.touches), 0);
        return Math.max(1, touches);
      });
      networkId = preferredNetworkIds[rng.choiceWeighted(weights)];
    } else if (rng.bool(config.networks.homeProviderNetworkProbability)) {
      networkId = homeProviderNetworkId;
    } else {
      networkId = rng.choiceWeighted(providerNetworkWeights);
    }
    const org = chooseOrgInNetwork(
      rng,
      providerOrgsGrouped.byNetwork,
      providerOrgsGrouped.weightsByNetwork,
      networkId,
      relationshipSet
    );
    relationshipSet.add(org.id);
    const rel: Relationship = {
      id: relationshipIdCounter++,
      orgId: org.id,
      networkId: org.networkId,
      isBaseline,
      isCareTeam: false,
      touches: 0,
    };
    relationships.push(rel);
    return rel;
  }

  for (let i = 0; i < baselineRelationshipCount; i++) {
    const existingNetworks = Array.from(new Set(relationships.map((r) => r.networkId)));
    addRelationship(true, existingNetworks);
  }

  // Care team formation among baseline relationships:
  if (relationships.length > 0 && config.consumers.providerConsumersEnabled) {
    // Mark one baseline relationship as "primary" more often.
    const primaryIdx = rng.int(relationships.length);
    if (rng.bool(cohort.primaryCareTeamProbability * config.consumers.providerCareTeamIntensity)) {
      relationships[primaryIdx].isCareTeam = true;
    }
    for (let i = 0; i < relationships.length; i++) {
      if (i === primaryIdx) continue;
      if (rng.bool(cohort.additionalCareTeamProbability * config.consumers.providerCareTeamIntensity * Math.min(1.6, Math.sqrt(util)))) {
        relationships[i].isCareTeam = true;
      }
    }
  }

  // App enrollment.
  const enrolled = rng.bool(Math.min(0.95, config.population.appEnrollmentRate * cohort.appEnrollmentMultiplier));
  const appEndpoints: AppEndpoint[] = [];
  if (enrolled) {
    let appCount = 1 + rng.poisson(config.population.meanExtraAppsIfEnrolled * Math.pow(util, 0.15));
    appCount = Math.min(config.population.maxAppsPerPatient, Math.max(1, appCount));
    const vendorSet = new Set<number>();

    const dominantNetworkId =
      relationships.length > 0
        ? mode(relationships.map((r) => r.networkId)) ?? homeProviderNetworkId
        : homeProviderNetworkId;

    let firstAppNetworkId =
      rng.bool(config.networks.sameNetworkAppProbability) ? dominantNetworkId : rng.choiceWeighted(appNetworkWeights);

    // If the dominant provider network has no apps allocated, fallback.
    if (appVendorsGrouped.byNetwork[firstAppNetworkId].length === 0) {
      firstAppNetworkId = rng.choiceWeighted(appNetworkWeights);
    }

    const firstVendor = chooseAppInNetwork(
      rng,
      appVendorsGrouped.byNetwork,
      appVendorsGrouped.weightsByNetwork,
      firstAppNetworkId,
      vendorSet
    );
    vendorSet.add(firstVendor.id);
    appEndpoints.push({ vendorId: firstVendor.id, networkId: firstVendor.networkId });

    while (appEndpoints.length < appCount) {
      let networkId =
        rng.bool(config.networks.multiAppSameNetworkProbability) ? firstAppNetworkId : rng.choiceWeighted(appNetworkWeights);
      if (appVendorsGrouped.byNetwork[networkId].length === 0) {
        networkId = rng.choiceWeighted(appNetworkWeights);
      }
      const vendor = chooseAppInNetwork(
        rng,
        appVendorsGrouped.byNetwork,
        appVendorsGrouped.weightsByNetwork,
        networkId,
        vendorSet
      );
      vendorSet.add(vendor.id);
      appEndpoints.push({ vendorId: vendor.id, networkId: vendor.networkId });
    }
  }

  // Payer enrollment.
  const payerEndpoints: PayerEndpoint[] = [];
  if (rng.bool(config.payers.enrollmentRate)) {
    const payerCount = Math.max(1, rng.poisson(config.payers.meanPayersPerPatient));
    const payerIdSet = new Set<number>();
    const allPayerWeights = payersList.map((p) => p.weight);
    for (let i = 0; i < payerCount && i < payersList.length; i++) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const idx = rng.choiceWeighted(allPayerWeights);
        const candidate = payersList[idx];
        if (!payerIdSet.has(candidate.id)) {
          payerIdSet.add(candidate.id);
          payerEndpoints.push({ payerId: candidate.id, networkId: candidate.networkId });
          break;
        }
      }
    }
  }

  // Build episode list from calibrated annual rates.
  const outpatientCount = rng.poisson(cohort.meanOutpatientEpisodes * util);
  const edCount = rng.poisson(cohort.meanEdEpisodes * util);
  const inpatientCount = rng.poisson(cohort.meanInpatientAdmissions * util);

  const episodeTypes: EpisodeType[] = [];
  for (let i = 0; i < outpatientCount; i++) episodeTypes.push("outpatient");
  for (let i = 0; i < edCount; i++) episodeTypes.push("ed");
  for (let i = 0; i < inpatientCount; i++) episodeTypes.push("inpatient");
  rng.shuffleInPlace(episodeTypes);

  const episodes: Episode[] = [];
  let newRelationshipCount = 0;

  function chooseExistingRelationship(currentRelationships: Relationship[]): Relationship {
    const weights = currentRelationships.map((r) => Math.pow(1 + r.touches, config.sources.sourceSelectionStickiness));
    return currentRelationships[rng.choiceWeighted(weights)];
  }

  for (const type of episodeTypes) {
    const currentRelationships = [...relationships];
    let source: Relationship;
    let isNewRelationship = false;

    let pNew: number;
    if (currentRelationships.length === 0) {
      pNew = 1.0;
    } else {
      const baseByType: Record<EpisodeType, number> = {
        outpatient: 0.60,
        ed: 0.82,
        inpatient: 0.76,
      };
      const decay = 1 / (1 + 0.42 * currentRelationships.length);
      pNew = Math.min(0.95, baseByType[type] * fragmentation * decay * Math.pow(util, 0.08));
    }

    if (
      currentRelationships.length === 0 ||
      (currentRelationships.length < config.sources.maxRelationshipsPerPatient && rng.bool(pNew))
    ) {
      const existingNetworkIds = Array.from(new Set(currentRelationships.map((r) => r.networkId)));
      source = addRelationship(false, existingNetworkIds);
      isNewRelationship = true;
      newRelationshipCount += 1;
      if (
        config.consumers.providerConsumersEnabled &&
        rng.bool(cohort.newRelationshipCareTeamProbability * config.consumers.providerCareTeamIntensity * Math.min(1.7, Math.sqrt(util)))
      ) {
        source.isCareTeam = true;
      }
    } else {
      source = chooseExistingRelationship(currentRelationships);
    }

    const providerRecipients = relationships
      .filter((r) => r.id !== source.id && r.isCareTeam)
      .map((r) => r.id);
    const providerRecipientNetworks = Array.from(
      new Set(providerRecipients.map((relId) => relationships.find((r) => r.id === relId)!.networkId))
    );
    const patientAppNetworks = Array.from(new Set(appEndpoints.map((a) => a.networkId)));
    const patientPayerNetworks = Array.from(new Set(payerEndpoints.map((p) => p.networkId)));

    source.touches += 1;

    const clinicalCopies =
      Math.round(
        (type === "outpatient"
          ? config.events.outpatientCompletedNotifications + config.events.outpatientScheduledMultiplier
          : type === "ed"
          ? config.events.edNotifications
          : config.events.inpatientAdmissionNotifications + config.events.inpatientDischargeNotifications) * 100
      ) / 100;

    episodes.push({
      type,
      sourceRelationshipId: source.id,
      sourceOrgId: source.orgId,
      sourceNetworkId: source.networkId,
      isNewRelationship,
      patientAppNetworks,
      patientAppCount: appEndpoints.length,
      patientPayerNetworks,
      patientPayerCount: payerEndpoints.length,
      providerRecipientRelationshipIds: providerRecipients,
      providerRecipientNetworks,
      providerRecipientCount: providerRecipients.length,
      clinicalNotificationCopies: clinicalCopies,
    });
  }

  const distinctProviderNetworks = new Set(relationships.map((r) => r.networkId)).size;
  const totalNotifications = episodes.reduce((s, e) => s + e.clinicalNotificationCopies, 0);

  return {
    id: patientId,
    weight,
    cohortName: cohort.name,
    utilizationMultiplier: util,
    fragmentation,
    homeProviderNetworkId,
    appEndpoints,
    payerEndpoints,
    relationships,
    baselineRelationshipCount,
    newRelationshipCount,
    episodes,
    totalNotifications,
    distinctProviderNetworks,
  };
}

function mode(values: number[]): number | undefined {
  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  let best: number | undefined = undefined;
  let bestCount = -1;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  });
  return best;
}

function buildWorld(config: SimulationConfig): SyntheticWorld {
  const rng = new RNG(config.seed);
  const networks = createNetworks(config);
  const providerOrgs = createProviderOrgs(config, networks, rng);
  const appVendors = createAppVendors(config, networks, rng);
  const payersList = createPayers(config, networks, rng);

  const providerOrgsGrouped = groupedWeights(providerOrgs, networks.length);
  const appVendorsGrouped = groupedWeights(appVendors, networks.length);
  const payersGrouped = groupedWeights(payersList, networks.length);

  const patients: Patient[] = [];
  for (let i = 0; i < config.population.samplePatients; i++) {
    patients.push(
      buildPatient(
        i,
        config,
        networks,
        providerOrgs,
        appVendors,
        payersList,
        providerOrgsGrouped,
        appVendorsGrouped,
        payersGrouped,
        rng
      )
    );
  }

  const summary = summarizeWorld(patients, networks);
  return { config, networks, providerOrgs, appVendors, payers: payersList, patients, summary };
}

function summarizeWorld(patients: Patient[], networks: Network[]): WorldSummary {
  const weights = patients.map((p) => p.weight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedMean = (getter: (p: Patient) => number): number =>
    patients.reduce((s, p) => s + getter(p) * p.weight, 0) / totalWeight;

  const appsPerPatient = patients.map((p) => p.appEndpoints.length);
  const enrolled = patients.filter((p) => p.appEndpoints.length > 0);
  const payerEnrolled = patients.filter((p) => p.payerEndpoints.length > 0);
  const relsPerPatient = patients.map((p) => p.relationships.length);
  const networksPerPatient = patients.map((p) => p.distinctProviderNetworks);

  const weightedEpisodes = patients.map((p) => ({ p, x: p.episodes.length * p.weight }));
  const totalEpisodesWeighted = weightedEpisodes.reduce((s, v) => s + v.x, 0);
  const sortedByEpisodes = [...patients].sort((a, b) => b.episodes.length - a.episodes.length);
  let runningWeight = 0;
  let runningEpisodes = 0;
  for (const p of sortedByEpisodes) {
    if (runningWeight / totalWeight >= 0.05) break;
    runningWeight += p.weight;
    runningEpisodes += p.episodes.length * p.weight;
  }

  return {
    weightedPopulation: totalWeight,
    meanAppsPerPatient: weightedMean((p) => p.appEndpoints.length),
    meanAppsPerEnrolledPatient:
      enrolled.length === 0 ? 0 : enrolled.reduce((s, p) => s + p.appEndpoints.length, 0) / enrolled.length,
    enrolledPatientRate: patients.filter((p) => p.appEndpoints.length > 0).length / patients.length,
    meanPayersPerPatient: weightedMean((p) => p.payerEndpoints.length),
    payerEnrollmentRate: payerEnrolled.length / patients.length,
    meanRelationshipsPerPatient: weightedMean((p) => p.relationships.length),
    p50Relationships: quantile(relsPerPatient, 0.5),
    p95Relationships: quantile(relsPerPatient, 0.95),
    meanDistinctProviderNetworksPerPatient: weightedMean((p) => p.distinctProviderNetworks),
    meanEpisodesPerPatient: weightedMean((p) => p.episodes.length),
    top5PctPatientShareOfEpisodes: totalEpisodesWeighted === 0 ? 0 : runningEpisodes / totalEpisodesWeighted,
    providerNetworkShares: networks
      .map((n) => ({ network: n.name, share: n.providerWeight, archetype: n.archetype }))
      .sort((a, b) => b.share - a.share),
    appNetworkShares: networks
      .map((n) => ({ network: n.name, share: n.appWeight, archetype: n.archetype }))
      .sort((a, b) => b.share - a.share),
  };
}

function blankStakeholders(): StakeholderBurden {
  return {
    sources: {
      totalOutboundMessages: 0,
      totalAuthChecks: 0,
      totalSubscriptionsManaged: 0,
      meanSubsPerSource: 0,
      p95SubsPerSource: 0,
      meanMsgsPerSourcePerDay: 0,
      p95MsgsPerSourcePerDay: 0,
    },
    networks: {
      totalRelayMessages: 0,
      totalRoutingState: 0,
      peerInterestCopies: 0,
      totalFanOutToClients: 0,
    },
    apps: {
      totalSubscriptions: 0,
      totalNotificationsReceived: 0,
      meanSubsPerEnrolledPatient: 0,
    },
    payers: {
      totalSubscriptions: 0,
      totalNotificationsReceived: 0,
      annualChurnSubscriptions: 0,
      ghostSubscriptions: 0,
      ghostNotificationsWasted: 0,
    },
  };
}

function blankResult(model: ProtocolName, description: string): ProtocolResult {
  return {
    model,
    description,
    annual: {
      clinicalEventsObserved: 0,
      newCareSignalsObserved: 0,
      sourceToNetworkMessages: 0,
      sourceToConsumerMessages: 0,
      networkToNetworkMessages: 0,
      networkToConsumerMessages: 0,
      controlPlaneMessages: 0,
      dataPlaneBytes: 0,
      controlPlaneBytes: 0,
      sourceAuthChecks: 0,
      networkRoutingChecks: 0,
      encryptionOperations: 0,
      decryptionOperations: 0,
    },
    state: {
      appToNetworkSubscriptions: 0,
      payerToNetworkSubscriptions: 0,
      providerInterestRegistrations: 0,
      peerInterestCopies: 0,
      directSourceSubscriptions: 0,
      directSourceSubscriptions_apps: 0,
      directSourceSubscriptions_payers: 0,
      directSourceSubscriptions_providers: 0,
      ghostSubscriptions: 0,
      keyCopiesAtNetworks: 0,
      keyCopiesAtSources: 0,
    },
    derived: {
      totalAnnualMessages: 0,
      dataPlaneMessages: 0,
      controlPlaneMessages: 0,
      meanDailyMessages: 0,
      p95DailyMessages: 0,
    },
    stakeholders: blankStakeholders(),
  };
}

function providerCapableNetworkCount(networks: Network[], config: SimulationConfig): number {
  return Math.max(1, Math.round(networks.length * config.networks.providerCapableNetworkFraction));
}

function computePerSourceStats(
  perSource: Map<number, PerSourceStats>,
  totalOrgs: number
): { meanSubs: number; p95Subs: number; meanMsgsPerDay: number; p95MsgsPerDay: number } {
  const subs: number[] = [];
  const msgsPerDay: number[] = [];
  perSource.forEach((stats) => {
    subs.push(stats.subscriptions);
    msgsPerDay.push(stats.annualOutboundMessages / 365);
  });
  // Orgs with no activity get zeros
  const remainingOrgs = totalOrgs - perSource.size;
  for (let i = 0; i < remainingOrgs; i++) {
    subs.push(0);
    msgsPerDay.push(0);
  }
  return {
    meanSubs: mean(subs),
    p95Subs: quantile(subs, 0.95),
    meanMsgsPerDay: mean(msgsPerDay),
    p95MsgsPerDay: quantile(msgsPerDay, 0.95),
  };
}

function addToPerSource(map: Map<number, PerSourceStats>, orgId: number, subs: number, msgs: number, auth: number): void {
  const existing = map.get(orgId);
  if (existing) {
    existing.subscriptions += subs;
    existing.annualOutboundMessages += msgs;
    existing.annualAuthChecks += auth;
  } else {
    map.set(orgId, { subscriptions: subs, annualOutboundMessages: msgs, annualAuthChecks: auth });
  }
}

function runModelA(world: SyntheticWorld): ProtocolResult {
  const config = world.config;
  const result = blankResult("A", "Subscriptions Broker — network-routed notifications, clients subscribe at Broker");

  const providerPeerNetworks = providerCapableNetworkCount(world.networks, config);
  const perSource = new Map<number, PerSourceStats>();

  let appNotificationsReceived = 0;
  let payerNotificationsReceived = 0;

  for (const patient of world.patients) {
    const weight = patient.weight;
    const distinctAppNetworks = new Set(patient.appEndpoints.map((a) => a.networkId)).size;
    const distinctPayerNetworks = new Set(patient.payerEndpoints.map((p) => p.networkId)).size;
    const distinctConsumerNetworks = new Set([
      ...patient.appEndpoints.map((a) => a.networkId),
      ...patient.payerEndpoints.map((p) => p.networkId),
    ]).size;

    // Control plane state and annual churn.
    result.state.appToNetworkSubscriptions += patient.appEndpoints.length * weight;
    result.state.payerToNetworkSubscriptions += patient.payerEndpoints.length * weight;
    const careTeamCount = patient.relationships.filter((r) => r.isCareTeam).length;
    result.state.providerInterestRegistrations += careTeamCount * weight;

    if (config.modelA.propagateInterestToAllProviderNetworks) {
      result.state.peerInterestCopies += distinctConsumerNetworks * providerPeerNetworks * weight;

      // App churn
      const churnedAppSubs = patient.appEndpoints.length * config.population.annualAppChurnRate * weight;
      result.annual.controlPlaneMessages += churnedAppSubs; // create
      result.annual.controlPlaneBytes += churnedAppSubs * config.events.payloadBytes.appSubscriptionCreate;
      result.annual.controlPlaneMessages += churnedAppSubs; // delete
      result.annual.controlPlaneBytes += churnedAppSubs * config.events.payloadBytes.appSubscriptionDelete;

      // Payer churn (monthly rate × 12)
      const annualPayerChurnRate = config.payers.monthlyMemberChurnRate * 12;
      const churnedPayerSubs = patient.payerEndpoints.length * annualPayerChurnRate * weight;
      result.annual.controlPlaneMessages += churnedPayerSubs; // create
      result.annual.controlPlaneBytes += churnedPayerSubs * config.events.payloadBytes.appSubscriptionCreate;
      result.annual.controlPlaneMessages += churnedPayerSubs; // delete
      result.annual.controlPlaneBytes += churnedPayerSubs * config.events.payloadBytes.appSubscriptionDelete;

      // Peer interest propagation for consumer churn
      const peerCopies = distinctConsumerNetworks * providerPeerNetworks * (config.population.annualAppChurnRate + annualPayerChurnRate) * weight;
      result.annual.controlPlaneMessages += peerCopies;
      result.annual.controlPlaneBytes += peerCopies * config.events.payloadBytes.interestPropagation;
    }

    for (const episode of patient.episodes) {
      const w = weight * episode.clinicalNotificationCopies;
      const sourceNetworkId = episode.sourceNetworkId;
      const recipientNetworks = new Set<number>([
        ...episode.patientAppNetworks,
        ...episode.patientPayerNetworks,
        ...episode.providerRecipientNetworks,
      ]);
      const remoteNetworks = Array.from(recipientNetworks).filter((n) => n !== sourceNetworkId);

      const localAppRecipients = patient.appEndpoints.filter((a) => a.networkId === sourceNetworkId).length;
      const localPayerRecipients = patient.payerEndpoints.filter((p) => p.networkId === sourceNetworkId).length;
      const localProviderRecipients = patient.relationships.filter(
        (r) => r.isCareTeam && r.id !== episode.sourceRelationshipId && r.networkId === sourceNetworkId
      ).length;
      const localRecipients = localAppRecipients + localPayerRecipients + localProviderRecipients;
      const remoteAppRecipients = patient.appEndpoints.length - localAppRecipients;
      const remotePayerRecipients = patient.payerEndpoints.length - localPayerRecipients;
      const remoteProviderRecipients = episode.providerRecipientCount - localProviderRecipients;
      const totalRecipients = localRecipients + remoteAppRecipients + remotePayerRecipients + remoteProviderRecipients;

      result.annual.clinicalEventsObserved += w;
      result.annual.sourceToNetworkMessages += w;
      result.annual.networkToNetworkMessages += remoteNetworks.length * w;
      result.annual.networkToConsumerMessages += totalRecipients * w;
      result.annual.dataPlaneBytes +=
        (1 + remoteNetworks.length + totalRecipients) *
        (config.events.payloadBytes.clinicalNotification) *
        w;

      result.annual.sourceAuthChecks += w; // source authenticates its network-facing send
      result.annual.networkRoutingChecks += totalRecipients * w;

      // Per-source tracking: source sends 1 message to its network
      addToPerSource(perSource, episode.sourceOrgId, 0, w, w);

      // Stakeholder: app and payer notification counts
      appNotificationsReceived += (localAppRecipients + remoteAppRecipients) * w;
      payerNotificationsReceived += (localPayerRecipients + remotePayerRecipients) * w;
    }
  }

  // Compute per-source stats
  const perSourceStats = computePerSourceStats(perSource, config.sources.totalOrganizations);
  result.stakeholders.sources.meanSubsPerSource = 0; // A: sources have no direct subscriptions
  result.stakeholders.sources.p95SubsPerSource = 0;
  result.stakeholders.sources.meanMsgsPerSourcePerDay = perSourceStats.meanMsgsPerDay;
  result.stakeholders.sources.p95MsgsPerSourcePerDay = perSourceStats.p95MsgsPerDay;
  result.stakeholders.sources.totalOutboundMessages = result.annual.sourceToNetworkMessages;
  result.stakeholders.sources.totalAuthChecks = result.annual.sourceAuthChecks;
  result.stakeholders.sources.totalSubscriptionsManaged = 0;

  result.stakeholders.networks.totalRelayMessages =
    result.annual.sourceToNetworkMessages + result.annual.networkToNetworkMessages + result.annual.networkToConsumerMessages;
  result.stakeholders.networks.totalRoutingState =
    result.state.appToNetworkSubscriptions + result.state.payerToNetworkSubscriptions + result.state.peerInterestCopies;
  result.stakeholders.networks.peerInterestCopies = result.state.peerInterestCopies;
  result.stakeholders.networks.totalFanOutToClients = result.annual.networkToConsumerMessages;

  result.stakeholders.apps.totalSubscriptions = result.state.appToNetworkSubscriptions;
  result.stakeholders.apps.totalNotificationsReceived = appNotificationsReceived;
  const enrolledPatientCount = world.patients.filter((p) => p.appEndpoints.length > 0).length;
  result.stakeholders.apps.meanSubsPerEnrolledPatient = enrolledPatientCount > 0
    ? 1 // In A, each patient has 1 subscription at the Broker
    : 0;

  result.stakeholders.payers.totalSubscriptions = result.state.payerToNetworkSubscriptions;
  result.stakeholders.payers.totalNotificationsReceived = payerNotificationsReceived;
  const annualPayerChurnRate = config.payers.monthlyMemberChurnRate * 12;
  result.stakeholders.payers.annualChurnSubscriptions = result.state.payerToNetworkSubscriptions * annualPayerChurnRate;
  result.stakeholders.payers.ghostSubscriptions = 0;
  result.stakeholders.payers.ghostNotificationsWasted = 0;

  finalizeDerived(world, result);
  return result;
}

function runModelB(world: SyntheticWorld): ProtocolResult {
  const config = world.config;
  const result = blankResult("B", "Relationship Feed + Source Feed — new-care signals via Broker, clinical data direct from source");

  const providerPeerNetworks = providerCapableNetworkCount(world.networks, config);
  const perSource = new Map<number, PerSourceStats>();
  const failRate = config.modelB.deactivationFailureRate;

  let appNotificationsReceived = 0;
  let payerNotificationsReceived = 0;
  let ghostSubsAccumulated = 0;
  let ghostNotificationLoad = 0;

  for (const patient of world.patients) {
    const weight = patient.weight;
    const careTeamCount = patient.relationships.filter((r) => r.isCareTeam).length;
    const distinctAppNetworks = new Set(patient.appEndpoints.map((a) => a.networkId)).size;
    const distinctPayerNetworks = new Set(patient.payerEndpoints.map((p) => p.networkId)).size;
    const distinctConsumerNetworks = new Set([
      ...patient.appEndpoints.map((a) => a.networkId),
      ...patient.payerEndpoints.map((p) => p.networkId),
    ]).size;

    // Active state: new-care-relationship subscriptions at Home Broker
    result.state.appToNetworkSubscriptions += patient.appEndpoints.length * weight;
    result.state.payerToNetworkSubscriptions += patient.payerEndpoints.length * weight;
    result.state.providerInterestRegistrations += careTeamCount * weight;

    // Peer interest: multiplexed (1 subject-handle per patient per peer pair, not per client)
    result.state.peerInterestCopies += distinctConsumerNetworks * providerPeerNetworks * weight;

    // Direct source subscriptions at baseline sources
    const baselineSources = patient.baselineRelationshipCount;
    const appDirect = patient.appEndpoints.length * baselineSources;
    const payerDirect = patient.payerEndpoints.length * baselineSources;
    let providerDirect = 0;
    for (const rel of patient.relationships.filter((r) => r.isBaseline && r.isCareTeam)) {
      providerDirect += Math.max(0, baselineSources - 1);
    }
    result.state.directSourceSubscriptions += (appDirect + payerDirect + providerDirect) * weight;
    result.state.directSourceSubscriptions_apps += appDirect * weight;
    result.state.directSourceSubscriptions_payers += payerDirect * weight;
    result.state.directSourceSubscriptions_providers += providerDirect * weight;

    // Per-source tracking for baseline subscriptions
    for (const rel of patient.relationships.filter((r) => r.isBaseline)) {
      const subsAtThisSource = patient.appEndpoints.length + patient.payerEndpoints.length +
        patient.relationships.filter((r2) => r2.isBaseline && r2.isCareTeam && r2.id !== rel.id).length;
      addToPerSource(perSource, rel.orgId, subsAtThisSource * weight, 0, 0);
    }

    // Annual churn on app-side network subscription (Home Broker)
    const churnedAppSubs = patient.appEndpoints.length * config.population.annualAppChurnRate * 2 * weight;
    result.annual.controlPlaneMessages += churnedAppSubs;
    result.annual.controlPlaneBytes +=
      churnedAppSubs *
      ((config.events.payloadBytes.appSubscriptionCreate + config.events.payloadBytes.appSubscriptionDelete) / 2);

    // Annual churn on payer-side network subscription (Home Broker)
    const annualPayerChurnRate = config.payers.monthlyMemberChurnRate * 12;
    const churnedPayerSubs = patient.payerEndpoints.length * annualPayerChurnRate * 2 * weight;
    result.annual.controlPlaneMessages += churnedPayerSubs;
    result.annual.controlPlaneBytes +=
      churnedPayerSubs *
      ((config.events.payloadBytes.appSubscriptionCreate + config.events.payloadBytes.appSubscriptionDelete) / 2);

    // Peer interest propagation churn
    const peerCopies = distinctConsumerNetworks * providerPeerNetworks * (config.population.annualAppChurnRate + annualPayerChurnRate) * weight;
    result.annual.controlPlaneMessages += peerCopies;
    result.annual.controlPlaneBytes += peerCopies * config.events.payloadBytes.interestPropagation;

    // Direct source subscription churn (apps + payers deactivating/reactivating at each source)
    const directAppChurn = appDirect * config.population.annualAppChurnRate * weight;
    const directPayerChurn = payerDirect * annualPayerChurnRate * weight;
    const directTotalChurn = directAppChurn + directPayerChurn;
    // Each churn event = 1 deactivation + 1 new activation at source
    result.annual.controlPlaneMessages += directTotalChurn * 2;
    result.annual.controlPlaneBytes += directTotalChurn * 2 * config.events.payloadBytes.appSubscriptionCreate;

    // Ghost subscriptions from failed deactivations at sources
    const failedDeactivations = directTotalChurn * failRate;
    ghostSubsAccumulated += failedDeactivations;

    // Event handling
    for (const episode of patient.episodes) {
      const w = weight * episode.clinicalNotificationCopies;

      if (episode.isNewRelationship && !config.modelB.deliverClinicalEventOnNewRelationship) {
        // New-care relationship signal goes through networks (control plane), not direct.
        const recipientNetworks = new Set<number>([
          ...episode.patientAppNetworks,
          ...episode.patientPayerNetworks,
          ...episode.providerRecipientNetworks,
        ]);
        const remoteNetworks = Array.from(recipientNetworks).filter((n) => n !== episode.sourceNetworkId);

        const localAppRecipients = patient.appEndpoints.filter((a) => a.networkId === episode.sourceNetworkId).length;
        const localPayerRecipients = patient.payerEndpoints.filter((p) => p.networkId === episode.sourceNetworkId).length;
        const localProviderRecipients = patient.relationships.filter(
          (r) => r.isCareTeam && r.id !== episode.sourceRelationshipId && r.networkId === episode.sourceNetworkId
        ).length;
        const totalRecipients =
          localAppRecipients + localPayerRecipients + localProviderRecipients +
          (patient.appEndpoints.length - localAppRecipients) +
          (patient.payerEndpoints.length - localPayerRecipients) +
          (episode.providerRecipientCount - localProviderRecipients);

        result.annual.newCareSignalsObserved += weight;
        result.annual.sourceToNetworkMessages += weight;
        result.annual.networkToNetworkMessages += remoteNetworks.length * weight;
        result.annual.networkToConsumerMessages += totalRecipients * weight;
        result.annual.dataPlaneBytes +=
          (1 + remoteNetworks.length + totalRecipients) *
          config.events.payloadBytes.careRelationshipNotification *
          weight;

        // After the new-care signal, consumers subscribe to the new source.
        const newDirectSubs = (patient.appEndpoints.length + patient.payerEndpoints.length + episode.providerRecipientCount) * weight;
        result.state.directSourceSubscriptions += newDirectSubs;
        result.state.directSourceSubscriptions_apps += patient.appEndpoints.length * weight;
        result.state.directSourceSubscriptions_payers += patient.payerEndpoints.length * weight;
        result.state.directSourceSubscriptions_providers += episode.providerRecipientCount * weight;
        result.annual.controlPlaneMessages += newDirectSubs;
        result.annual.controlPlaneBytes += newDirectSubs * config.events.payloadBytes.appSubscriptionCreate;

        // Per-source: new subscriptions at this source
        addToPerSource(perSource, episode.sourceOrgId, newDirectSubs, 0, 0);

        // Stakeholder notifications from new-care signal
        appNotificationsReceived += patient.appEndpoints.length * weight;
        payerNotificationsReceived += patient.payerEndpoints.length * weight;

        continue;
      }

      // Non-new-relationship: direct from source to each subscriber
      const directRecipients = patient.appEndpoints.length + patient.payerEndpoints.length + episode.providerRecipientCount;
      result.annual.clinicalEventsObserved += w;
      result.annual.sourceToConsumerMessages += directRecipients * w;
      result.annual.dataPlaneBytes +=
        directRecipients *
        config.events.payloadBytes.clinicalNotification *
        w;

      // Direct auth at the source for every subscriber.
      result.annual.sourceAuthChecks += directRecipients * w;

      // Per-source tracking
      addToPerSource(perSource, episode.sourceOrgId, 0, directRecipients * w, directRecipients * w);

      // Stakeholder notifications
      appNotificationsReceived += patient.appEndpoints.length * w;
      payerNotificationsReceived += patient.payerEndpoints.length * w;
    }
  }

  // Ghost subscription wasted load: ghosts receive notifications they shouldn't
  // Estimate wasted load = ghost subs × mean notifications per subscription per year
  const totalDirectSubs = result.state.directSourceSubscriptions;
  const totalDataMsgs = result.annual.sourceToConsumerMessages;
  const meanNotifsPerSub = totalDirectSubs > 0 ? totalDataMsgs / totalDirectSubs : 0;
  ghostNotificationLoad = ghostSubsAccumulated * meanNotifsPerSub;
  result.state.ghostSubscriptions = ghostSubsAccumulated;

  // Compute per-source stats
  const perSourceStats = computePerSourceStats(perSource, config.sources.totalOrganizations);
  result.stakeholders.sources.meanSubsPerSource = perSourceStats.meanSubs;
  result.stakeholders.sources.p95SubsPerSource = perSourceStats.p95Subs;
  result.stakeholders.sources.meanMsgsPerSourcePerDay = perSourceStats.meanMsgsPerDay;
  result.stakeholders.sources.p95MsgsPerSourcePerDay = perSourceStats.p95MsgsPerDay;
  result.stakeholders.sources.totalOutboundMessages = result.annual.sourceToConsumerMessages;
  result.stakeholders.sources.totalAuthChecks = result.annual.sourceAuthChecks;
  result.stakeholders.sources.totalSubscriptionsManaged = result.state.directSourceSubscriptions;

  result.stakeholders.networks.totalRelayMessages =
    result.annual.sourceToNetworkMessages + result.annual.networkToNetworkMessages + result.annual.networkToConsumerMessages;
  result.stakeholders.networks.totalRoutingState =
    result.state.appToNetworkSubscriptions + result.state.payerToNetworkSubscriptions + result.state.peerInterestCopies;
  result.stakeholders.networks.peerInterestCopies = result.state.peerInterestCopies;
  result.stakeholders.networks.totalFanOutToClients = result.annual.networkToConsumerMessages;

  result.stakeholders.apps.totalSubscriptions =
    result.state.appToNetworkSubscriptions + result.state.directSourceSubscriptions_apps;
  result.stakeholders.apps.totalNotificationsReceived = appNotificationsReceived;
  const enrolledCount = world.patients.filter((p) => p.appEndpoints.length > 0).length;
  const totalWeight = world.patients.reduce((s, p) => s + p.weight, 0);
  const enrolledWeight = world.patients.filter((p) => p.appEndpoints.length > 0).reduce((s, p) => s + p.weight, 0);
  result.stakeholders.apps.meanSubsPerEnrolledPatient = enrolledWeight > 0
    ? (result.state.appToNetworkSubscriptions + result.state.directSourceSubscriptions_apps) / enrolledWeight
    : 0;

  const annualPayerChurnRate = config.payers.monthlyMemberChurnRate * 12;
  result.stakeholders.payers.totalSubscriptions =
    result.state.payerToNetworkSubscriptions + result.state.directSourceSubscriptions_payers;
  result.stakeholders.payers.totalNotificationsReceived = payerNotificationsReceived;
  result.stakeholders.payers.annualChurnSubscriptions =
    result.state.directSourceSubscriptions_payers * annualPayerChurnRate +
    result.state.payerToNetworkSubscriptions * annualPayerChurnRate;
  result.stakeholders.payers.ghostSubscriptions = ghostSubsAccumulated;
  result.stakeholders.payers.ghostNotificationsWasted = ghostNotificationLoad;

  finalizeDerived(world, result);
  return result;
}

function runModelBp(world: SyntheticWorld): ProtocolResult {
  const config = world.config;
  const result = blankResult("Bp", "Direct+Group — like Direct but payers use Group-based subscriptions (DaVinci ATR)");

  const providerPeerNetworks = providerCapableNetworkCount(world.networks, config);
  const perSource = new Map<number, PerSourceStats>();
  const failRate = config.modelB.deactivationFailureRate;

  let appNotificationsReceived = 0;
  let payerNotificationsReceived = 0;
  let ghostSubsAccumulated = 0;
  let ghostNotificationLoad = 0;

  // Track unique payer-source pairs for Group subscriptions
  const payerSourcePairs = new Set<string>();

  for (const patient of world.patients) {
    const weight = patient.weight;
    const careTeamCount = patient.relationships.filter((r) => r.isCareTeam).length;
    const distinctAppNetworks = new Set(patient.appEndpoints.map((a) => a.networkId)).size;
    const distinctConsumerNetworks = new Set([
      ...patient.appEndpoints.map((a) => a.networkId),
      ...patient.payerEndpoints.map((p) => p.networkId),
    ]).size;

    // Active state: new-care-relationship subscriptions at Home Broker
    result.state.appToNetworkSubscriptions += patient.appEndpoints.length * weight;
    result.state.payerToNetworkSubscriptions += patient.payerEndpoints.length * weight;
    result.state.providerInterestRegistrations += careTeamCount * weight;
    result.state.peerInterestCopies += distinctConsumerNetworks * providerPeerNetworks * weight;

    // Direct source subscriptions at baseline sources — apps + providers only, NOT payers
    const baselineSources = patient.baselineRelationshipCount;
    const appDirect = patient.appEndpoints.length * baselineSources;
    let providerDirect = 0;
    for (const rel of patient.relationships.filter((r) => r.isBaseline && r.isCareTeam)) {
      providerDirect += Math.max(0, baselineSources - 1);
    }
    result.state.directSourceSubscriptions += (appDirect + providerDirect) * weight;
    result.state.directSourceSubscriptions_apps += appDirect * weight;
    result.state.directSourceSubscriptions_providers += providerDirect * weight;
    // Payer subs are Group-based: track unique payer×source pairs
    for (const rel of patient.relationships.filter((r) => r.isBaseline)) {
      for (const pe of patient.payerEndpoints) {
        payerSourcePairs.add(`${pe.payerId}:${rel.orgId}`);
      }
    }

    // Per-source tracking for baseline subscriptions (apps + providers only)
    for (const rel of patient.relationships.filter((r) => r.isBaseline)) {
      const subsAtThisSource = patient.appEndpoints.length +
        patient.relationships.filter((r2) => r2.isBaseline && r2.isCareTeam && r2.id !== rel.id).length;
      addToPerSource(perSource, rel.orgId, subsAtThisSource * weight, 0, 0);
    }

    // Annual churn on app-side network subscription (Home Broker)
    const churnedAppSubs = patient.appEndpoints.length * config.population.annualAppChurnRate * 2 * weight;
    result.annual.controlPlaneMessages += churnedAppSubs;
    result.annual.controlPlaneBytes +=
      churnedAppSubs *
      ((config.events.payloadBytes.appSubscriptionCreate + config.events.payloadBytes.appSubscriptionDelete) / 2);

    // Annual churn on payer-side network subscription (Home Broker)
    const annualPayerChurnRate = config.payers.monthlyMemberChurnRate * 12;
    const churnedPayerSubs = patient.payerEndpoints.length * annualPayerChurnRate * 2 * weight;
    result.annual.controlPlaneMessages += churnedPayerSubs;
    result.annual.controlPlaneBytes +=
      churnedPayerSubs *
      ((config.events.payloadBytes.appSubscriptionCreate + config.events.payloadBytes.appSubscriptionDelete) / 2);

    // Peer interest propagation churn
    const peerCopies = distinctConsumerNetworks * providerPeerNetworks * (config.population.annualAppChurnRate + annualPayerChurnRate) * weight;
    result.annual.controlPlaneMessages += peerCopies;
    result.annual.controlPlaneBytes += peerCopies * config.events.payloadBytes.interestPropagation;

    // Direct source subscription churn — apps + providers only
    const directAppChurn = appDirect * config.population.annualAppChurnRate * weight;
    result.annual.controlPlaneMessages += directAppChurn * 2;
    result.annual.controlPlaneBytes += directAppChurn * 2 * config.events.payloadBytes.appSubscriptionCreate;

    // Payer churn = Group $member-add/$member-remove at each source the patient visits
    // Volume is similar to B (one op per source per member change) but these are Group membership ops
    const payerMemberChurn = patient.payerEndpoints.length * annualPayerChurnRate * baselineSources * weight;
    result.annual.controlPlaneMessages += payerMemberChurn * 2; // add + remove
    result.annual.controlPlaneBytes += payerMemberChurn * 2 * config.events.payloadBytes.appSubscriptionCreate;

    // Ghost: failed $member-remove means patient stays in Group (lighter than ghost subscription)
    const failedRemovals = (directAppChurn + payerMemberChurn) * failRate;
    ghostSubsAccumulated += failedRemovals;

    // Event handling — identical to Model B
    for (const episode of patient.episodes) {
      const w = weight * episode.clinicalNotificationCopies;

      if (episode.isNewRelationship && !config.modelB.deliverClinicalEventOnNewRelationship) {
        const recipientNetworks = new Set<number>([
          ...episode.patientAppNetworks,
          ...episode.patientPayerNetworks,
          ...episode.providerRecipientNetworks,
        ]);
        const remoteNetworks = Array.from(recipientNetworks).filter((n) => n !== episode.sourceNetworkId);

        const localAppRecipients = patient.appEndpoints.filter((a) => a.networkId === episode.sourceNetworkId).length;
        const localPayerRecipients = patient.payerEndpoints.filter((p) => p.networkId === episode.sourceNetworkId).length;
        const localProviderRecipients = patient.relationships.filter(
          (r) => r.isCareTeam && r.id !== episode.sourceRelationshipId && r.networkId === episode.sourceNetworkId
        ).length;
        const totalRecipients =
          localAppRecipients + localPayerRecipients + localProviderRecipients +
          (patient.appEndpoints.length - localAppRecipients) +
          (patient.payerEndpoints.length - localPayerRecipients) +
          (episode.providerRecipientCount - localProviderRecipients);

        result.annual.newCareSignalsObserved += weight;
        result.annual.sourceToNetworkMessages += weight;
        result.annual.networkToNetworkMessages += remoteNetworks.length * weight;
        result.annual.networkToConsumerMessages += totalRecipients * weight;
        result.annual.dataPlaneBytes +=
          (1 + remoteNetworks.length + totalRecipients) *
          config.events.payloadBytes.careRelationshipNotification *
          weight;

        // After new-care signal: apps + providers subscribe; payers just add member to existing Group
        const newAppProvSubs = (patient.appEndpoints.length + episode.providerRecipientCount) * weight;
        result.state.directSourceSubscriptions += newAppProvSubs;
        result.state.directSourceSubscriptions_apps += patient.appEndpoints.length * weight;
        result.state.directSourceSubscriptions_providers += episode.providerRecipientCount * weight;
        result.annual.controlPlaneMessages += newAppProvSubs;
        result.annual.controlPlaneBytes += newAppProvSubs * config.events.payloadBytes.appSubscriptionCreate;
        // Payers: $member-add to Group at new source
        const payerGroupOps = patient.payerEndpoints.length * weight;
        result.annual.controlPlaneMessages += payerGroupOps;
        result.annual.controlPlaneBytes += payerGroupOps * config.events.payloadBytes.appSubscriptionCreate;
        // Track payer-source pairs
        for (const pe of patient.payerEndpoints) {
          payerSourcePairs.add(`${pe.payerId}:${episode.sourceOrgId}`);
        }

        addToPerSource(perSource, episode.sourceOrgId, newAppProvSubs, 0, 0);

        appNotificationsReceived += patient.appEndpoints.length * weight;
        payerNotificationsReceived += patient.payerEndpoints.length * weight;
        continue;
      }

      // Non-new-relationship: direct from source to each subscriber (same as B)
      const directRecipients = patient.appEndpoints.length + patient.payerEndpoints.length + episode.providerRecipientCount;
      result.annual.clinicalEventsObserved += w;
      result.annual.sourceToConsumerMessages += directRecipients * w;
      result.annual.dataPlaneBytes +=
        directRecipients * config.events.payloadBytes.clinicalNotification * w;
      result.annual.sourceAuthChecks += directRecipients * w;

      addToPerSource(perSource, episode.sourceOrgId, 0, directRecipients * w, directRecipients * w);
      appNotificationsReceived += patient.appEndpoints.length * w;
      payerNotificationsReceived += patient.payerEndpoints.length * w;
    }
  }

  // Payer Group subscriptions: one per unique payer-source pair, scaled by weight
  const patientWeight = world.config.population.usPopulation / world.config.population.samplePatients;
  // payerSourcePairs is from the sample; the actual count at scale is similar (payers cover most sources)
  const payerGroupSubCount = payerSourcePairs.size;
  result.state.directSourceSubscriptions_payers = payerGroupSubCount;
  result.state.directSourceSubscriptions += payerGroupSubCount;

  // Ghost
  const totalDirectSubs = result.state.directSourceSubscriptions;
  const totalDataMsgs = result.annual.sourceToConsumerMessages;
  const meanNotifsPerSub = totalDirectSubs > 0 ? totalDataMsgs / totalDirectSubs : 0;
  ghostNotificationLoad = ghostSubsAccumulated * meanNotifsPerSub;
  result.state.ghostSubscriptions = ghostSubsAccumulated;

  // Per-source: add payer Group subs (totalPayers per active source)
  perSource.forEach((stats, orgId) => {
    stats.subscriptions += config.payers.totalPayers; // each active source gets ~totalPayers Group subs
  });

  const perSourceStats = computePerSourceStats(perSource, config.sources.totalOrganizations);
  result.stakeholders.sources.meanSubsPerSource = perSourceStats.meanSubs;
  result.stakeholders.sources.p95SubsPerSource = perSourceStats.p95Subs;
  result.stakeholders.sources.meanMsgsPerSourcePerDay = perSourceStats.meanMsgsPerDay;
  result.stakeholders.sources.p95MsgsPerSourcePerDay = perSourceStats.p95MsgsPerDay;
  result.stakeholders.sources.totalOutboundMessages = result.annual.sourceToConsumerMessages;
  result.stakeholders.sources.totalAuthChecks = result.annual.sourceAuthChecks;
  result.stakeholders.sources.totalSubscriptionsManaged = result.state.directSourceSubscriptions;

  result.stakeholders.networks.totalRelayMessages =
    result.annual.sourceToNetworkMessages + result.annual.networkToNetworkMessages + result.annual.networkToConsumerMessages;
  result.stakeholders.networks.totalRoutingState =
    result.state.appToNetworkSubscriptions + result.state.payerToNetworkSubscriptions + result.state.peerInterestCopies;
  result.stakeholders.networks.peerInterestCopies = result.state.peerInterestCopies;
  result.stakeholders.networks.totalFanOutToClients = result.annual.networkToConsumerMessages;

  result.stakeholders.apps.totalSubscriptions =
    result.state.appToNetworkSubscriptions + result.state.directSourceSubscriptions_apps;
  result.stakeholders.apps.totalNotificationsReceived = appNotificationsReceived;
  const enrolledWeight = world.patients.filter((p) => p.appEndpoints.length > 0).reduce((s, p) => s + p.weight, 0);
  result.stakeholders.apps.meanSubsPerEnrolledPatient = enrolledWeight > 0
    ? (result.state.appToNetworkSubscriptions + result.state.directSourceSubscriptions_apps) / enrolledWeight
    : 0;

  const annualPayerChurnRate = config.payers.monthlyMemberChurnRate * 12;
  result.stakeholders.payers.totalSubscriptions =
    result.state.payerToNetworkSubscriptions + payerGroupSubCount;
  result.stakeholders.payers.totalNotificationsReceived = payerNotificationsReceived;
  result.stakeholders.payers.annualChurnSubscriptions =
    result.state.payerToNetworkSubscriptions * annualPayerChurnRate; // Group subs don't churn, only broker subs
  result.stakeholders.payers.ghostSubscriptions = ghostSubsAccumulated;
  result.stakeholders.payers.ghostNotificationsWasted = ghostNotificationLoad;

  finalizeDerived(world, result);
  return result;
}

function runModelC(world: SyntheticWorld): ProtocolResult {
  const config = world.config;
  const result = blankResult("C", "Encrypted relay — network-routed encrypted notifications");

  const providerPeerNetworks = providerCapableNetworkCount(world.networks, config);
  const perSource = new Map<number, PerSourceStats>();

  let appNotificationsReceived = 0;
  let payerNotificationsReceived = 0;

  for (const patient of world.patients) {
    const weight = patient.weight;
    const careTeamCount = patient.relationships.filter((r) => r.isCareTeam).length;
    const allConsumerEndpoints = patient.appEndpoints.length + patient.payerEndpoints.length;

    result.state.appToNetworkSubscriptions += patient.appEndpoints.length * weight;
    result.state.payerToNetworkSubscriptions += patient.payerEndpoints.length * weight;
    result.state.providerInterestRegistrations += careTeamCount * weight;

    // In C the peer copies are per consumer endpoint key, not per distinct network.
    result.state.peerInterestCopies += allConsumerEndpoints * providerPeerNetworks * weight;
    result.state.keyCopiesAtNetworks += allConsumerEndpoints * providerPeerNetworks * weight;

    if (config.modelC.keyPropagationMode === "active-sources-only") {
      result.state.keyCopiesAtSources += allConsumerEndpoints * patient.relationships.length * weight;
    } else {
      result.state.keyCopiesAtSources += allConsumerEndpoints * world.providerOrgs.length * weight;
    }

    // Annual churn on app registration and key propagation.
    const churnedAppSubs = patient.appEndpoints.length * config.population.annualAppChurnRate * weight;
    result.annual.controlPlaneMessages += churnedAppSubs; // create
    result.annual.controlPlaneBytes += churnedAppSubs * config.events.payloadBytes.appSubscriptionCreate;
    result.annual.controlPlaneMessages += churnedAppSubs; // delete
    result.annual.controlPlaneBytes += churnedAppSubs * config.events.payloadBytes.appSubscriptionDelete;

    // Payer churn
    const annualPayerChurnRate = config.payers.monthlyMemberChurnRate * 12;
    const churnedPayerSubs = patient.payerEndpoints.length * annualPayerChurnRate * weight;
    result.annual.controlPlaneMessages += churnedPayerSubs;
    result.annual.controlPlaneBytes += churnedPayerSubs * config.events.payloadBytes.appSubscriptionCreate;
    result.annual.controlPlaneMessages += churnedPayerSubs;
    result.annual.controlPlaneBytes += churnedPayerSubs * config.events.payloadBytes.appSubscriptionDelete;

    const totalChurnRate = config.population.annualAppChurnRate + annualPayerChurnRate;
    const peerKeyMessages = allConsumerEndpoints * providerPeerNetworks * totalChurnRate * 2 * weight;
    result.annual.controlPlaneMessages += peerKeyMessages;
    result.annual.controlPlaneBytes += peerKeyMessages * config.events.payloadBytes.publicKeyPropagation;

    const sourceKeyMessages =
      config.modelC.keyPropagationMode === "active-sources-only"
        ? allConsumerEndpoints * patient.relationships.length * totalChurnRate * 2 * weight
        : allConsumerEndpoints * world.providerOrgs.length * totalChurnRate * 2 * weight;
    result.annual.controlPlaneMessages += sourceKeyMessages;
    result.annual.controlPlaneBytes += sourceKeyMessages * config.events.payloadBytes.publicKeyPropagation;

    for (const episode of patient.episodes) {
      const w = weight * episode.clinicalNotificationCopies;
      const sourceNetworkId = episode.sourceNetworkId;
      const localAppRecipients = patient.appEndpoints.filter((a) => a.networkId === sourceNetworkId).length;
      const localPayerRecipients = patient.payerEndpoints.filter((p) => p.networkId === sourceNetworkId).length;
      const localProviderRecipients = patient.relationships.filter(
        (r) => r.isCareTeam && r.id !== episode.sourceRelationshipId && r.networkId === sourceNetworkId
      ).length;

      const remotePatientNetworks = Array.from(new Set(episode.patientAppNetworks.filter((n) => n !== sourceNetworkId)));
      const remotePayerNetworks = Array.from(new Set(episode.patientPayerNetworks.filter((n) => n !== sourceNetworkId)));
      const remoteProviderNetworks = Array.from(new Set(episode.providerRecipientNetworks.filter((n) => n !== sourceNetworkId)));

      if (config.modelC.encryptionMode === "recipient-category") {
        const hasPatientRecipients = patient.appEndpoints.length > 0;
        const hasPayerRecipients = patient.payerEndpoints.length > 0;
        const hasProviderRecipients = episode.providerRecipientCount > 0;
        const sourceMessages = Number(hasPatientRecipients) + Number(hasPayerRecipients) + Number(hasProviderRecipients);
        const remoteMessages =
          remotePatientNetworks.length + remotePayerNetworks.length + remoteProviderNetworks.length;
        const totalRecipients = patient.appEndpoints.length + patient.payerEndpoints.length + episode.providerRecipientCount;

        result.annual.clinicalEventsObserved += w;
        result.annual.sourceToNetworkMessages += sourceMessages * w;
        result.annual.networkToNetworkMessages += remoteMessages * w;
        result.annual.networkToConsumerMessages += totalRecipients * w;

        const blobSize = config.events.payloadBytes.clinicalNotification + config.events.encryptedOverheadBytes;
        result.annual.dataPlaneBytes +=
          (sourceMessages + remoteMessages + totalRecipients) *
          blobSize *
          w;

        result.annual.encryptionOperations += sourceMessages * w;
        result.annual.decryptionOperations += totalRecipients * w;
        result.annual.sourceAuthChecks += sourceMessages * w;
        result.annual.networkRoutingChecks += totalRecipients * w;

        addToPerSource(perSource, episode.sourceOrgId, 0, sourceMessages * w, sourceMessages * w);
        appNotificationsReceived += patient.appEndpoints.length * w;
        payerNotificationsReceived += patient.payerEndpoints.length * w;
      } else {
        const totalRecipients = patient.appEndpoints.length + patient.payerEndpoints.length + episode.providerRecipientCount;
        const remoteRecipients = Math.max(0, totalRecipients - (localAppRecipients + localPayerRecipients + localProviderRecipients));

        result.annual.clinicalEventsObserved += w;
        result.annual.sourceToNetworkMessages += totalRecipients * w;
        result.annual.networkToNetworkMessages += remoteRecipients * w;
        result.annual.networkToConsumerMessages += totalRecipients * w;

        const blobSize = config.events.payloadBytes.clinicalNotification + config.events.encryptedOverheadBytes;
        result.annual.dataPlaneBytes +=
          (totalRecipients + remoteRecipients + totalRecipients) *
          blobSize *
          w;

        result.annual.encryptionOperations += totalRecipients * w;
        result.annual.decryptionOperations += totalRecipients * w;
        result.annual.sourceAuthChecks += totalRecipients * w;
        result.annual.networkRoutingChecks += totalRecipients * w;

        addToPerSource(perSource, episode.sourceOrgId, 0, totalRecipients * w, totalRecipients * w);
        appNotificationsReceived += patient.appEndpoints.length * w;
        payerNotificationsReceived += patient.payerEndpoints.length * w;
      }
    }
  }

  // Per-source stats
  const perSourceStats = computePerSourceStats(perSource, config.sources.totalOrganizations);
  result.stakeholders.sources.meanSubsPerSource = 0;
  result.stakeholders.sources.p95SubsPerSource = 0;
  result.stakeholders.sources.meanMsgsPerSourcePerDay = perSourceStats.meanMsgsPerDay;
  result.stakeholders.sources.p95MsgsPerSourcePerDay = perSourceStats.p95MsgsPerDay;
  result.stakeholders.sources.totalOutboundMessages = result.annual.sourceToNetworkMessages;
  result.stakeholders.sources.totalAuthChecks = result.annual.sourceAuthChecks;
  result.stakeholders.sources.totalSubscriptionsManaged = 0;

  result.stakeholders.networks.totalRelayMessages =
    result.annual.sourceToNetworkMessages + result.annual.networkToNetworkMessages + result.annual.networkToConsumerMessages;
  result.stakeholders.networks.totalRoutingState =
    result.state.appToNetworkSubscriptions + result.state.payerToNetworkSubscriptions + result.state.peerInterestCopies;
  result.stakeholders.networks.peerInterestCopies = result.state.peerInterestCopies;
  result.stakeholders.networks.totalFanOutToClients = result.annual.networkToConsumerMessages;

  result.stakeholders.apps.totalSubscriptions = result.state.appToNetworkSubscriptions;
  result.stakeholders.apps.totalNotificationsReceived = appNotificationsReceived;
  result.stakeholders.apps.meanSubsPerEnrolledPatient = 1;

  result.stakeholders.payers.totalSubscriptions = result.state.payerToNetworkSubscriptions;
  result.stakeholders.payers.totalNotificationsReceived = payerNotificationsReceived;
  const annualPayerChurnRate = config.payers.monthlyMemberChurnRate * 12;
  result.stakeholders.payers.annualChurnSubscriptions = result.state.payerToNetworkSubscriptions * annualPayerChurnRate;
  result.stakeholders.payers.ghostSubscriptions = 0;
  result.stakeholders.payers.ghostNotificationsWasted = 0;

  finalizeDerived(world, result);
  return result;
}

function finalizeDerived(world: SyntheticWorld, result: ProtocolResult): void {
  const dataPlaneMessages =
    result.annual.sourceToNetworkMessages +
    result.annual.sourceToConsumerMessages +
    result.annual.networkToNetworkMessages +
    result.annual.networkToConsumerMessages;
  const controlPlaneMessages = result.annual.controlPlaneMessages;
  const totalAnnualMessages = dataPlaneMessages + controlPlaneMessages;

  result.derived.dataPlaneMessages = dataPlaneMessages;
  result.derived.controlPlaneMessages = controlPlaneMessages;
  result.derived.totalAnnualMessages = totalAnnualMessages;
  result.derived.meanDailyMessages = totalAnnualMessages / 365;

  // Negative-binomial style approximation for daily p95
  const meanDaily = totalAnnualMessages / 365;
  const k = world.config.events.dailyOverdispersionK;
  const variance = meanDaily + (meanDaily * meanDaily) / Math.max(1, k);
  const sd = Math.sqrt(variance);
  result.derived.p95DailyMessages = meanDaily + 1.645 * sd;
}

function runAll(world: SyntheticWorld): AllResults {
  return {
    world: world.summary,
    protocols: {
      A: runModelA(world),
      B: runModelB(world),
      Bp: runModelBp(world),
      C: runModelC(world),
    },
  };
}

function padCol(s: string, width: number): string {
  return s.padStart(width);
}

function compareProtocols(results: AllResults): string {
  const lines: string[] = [];

  // ─── Message volume ───
  lines.push("Message volume (annual, U.S.-scaled)");
  lines.push("");
  lines.push(
    [
      "Model".padEnd(15),
      "Data msgs".padStart(15),
      "Data GiB".padStart(12),
      "Ctrl msgs".padStart(15),
      "Ctrl GiB".padStart(12),
      "Total msgs".padStart(15),
      "Mean/day".padStart(13),
      "P95/day".padStart(13),
    ].join(" ")
  );

  (["A", "B", "Bp", "C"] as ProtocolName[]).forEach((name) => {
    const r = results.protocols[name];
    lines.push(
      [
        (PROTOCOL_LABELS[name] || name).padEnd(15),
        formatInt(r.derived.dataPlaneMessages).padStart(15),
        bytesToGiB(r.annual.dataPlaneBytes).padStart(12),
        formatInt(r.derived.controlPlaneMessages).padStart(15),
        bytesToGiB(r.annual.controlPlaneBytes).padStart(12),
        formatInt(r.derived.totalAnnualMessages).padStart(15),
        formatInt(r.derived.meanDailyMessages).padStart(13),
        formatInt(r.derived.p95DailyMessages).padStart(13),
      ].join(" ")
    );
  });

  // ─── State burdens ───
  lines.push("");
  lines.push("Subscription and routing state");
  lines.push(
    [
      "Model".padEnd(15),
      "App→Broker".padStart(14),
      "Payer→Broker".padStart(14),
      "Peer interest".padStart(15),
      "Direct src subs".padStart(17),
      "Ghost subs".padStart(14),
      "Keys@src".padStart(14),
    ].join(" ")
  );
  (["A", "B", "Bp", "C"] as ProtocolName[]).forEach((name) => {
    const r = results.protocols[name];
    lines.push(
      [
        (PROTOCOL_LABELS[name] || name).padEnd(15),
        formatInt(r.state.appToNetworkSubscriptions).padStart(14),
        formatInt(r.state.payerToNetworkSubscriptions).padStart(14),
        formatInt(r.state.peerInterestCopies).padStart(15),
        formatInt(r.state.directSourceSubscriptions).padStart(17),
        formatInt(r.state.ghostSubscriptions).padStart(14),
        formatInt(r.state.keyCopiesAtSources).padStart(14),
      ].join(" ")
    );
  });

  // ─── Per-source burden ───
  lines.push("");
  lines.push("Per-source (data source / provider) burden");
  lines.push(
    [
      "Model".padEnd(15),
      "Subs managed".padStart(14),
      "Mean subs/src".padStart(15),
      "P95 subs/src".padStart(14),
      "Mean msgs/src/day".padStart(19),
      "P95 msgs/src/day".padStart(18),
    ].join(" ")
  );
  (["A", "B", "Bp", "C"] as ProtocolName[]).forEach((name) => {
    const r = results.protocols[name];
    const s = r.stakeholders.sources;
    lines.push(
      [
        (PROTOCOL_LABELS[name] || name).padEnd(15),
        formatInt(s.totalSubscriptionsManaged).padStart(14),
        formatInt(s.meanSubsPerSource).padStart(15),
        formatInt(s.p95SubsPerSource).padStart(14),
        formatInt(s.meanMsgsPerSourcePerDay).padStart(19),
        formatInt(s.p95MsgsPerSourcePerDay).padStart(18),
      ].join(" ")
    );
  });

  // ─── Per-stakeholder ───
  lines.push("");
  lines.push("Per-stakeholder burden (annual)");
  lines.push("");

  // Sources
  lines.push("  Data Sources");
  lines.push(
    [
      "  Model".padEnd(17),
      "Outbound msgs".padStart(15),
      "Auth checks".padStart(15),
      "Subs to manage".padStart(16),
    ].join(" ")
  );
  (["A", "B", "Bp", "C"] as ProtocolName[]).forEach((name) => {
    const s = results.protocols[name].stakeholders.sources;
    lines.push(
      [
        ("  " + (PROTOCOL_LABELS[name] || name)).padEnd(17),
        formatInt(s.totalOutboundMessages).padStart(15),
        formatInt(s.totalAuthChecks).padStart(15),
        formatInt(s.totalSubscriptionsManaged).padStart(16),
      ].join(" ")
    );
  });

  // Networks
  lines.push("");
  lines.push("  Networks / Brokers");
  lines.push(
    [
      "  Model".padEnd(17),
      "Relay msgs".padStart(15),
      "Fan-out to clients".padStart(20),
      "Routing state".padStart(15),
      "Peer interest".padStart(15),
    ].join(" ")
  );
  (["A", "B", "Bp", "C"] as ProtocolName[]).forEach((name) => {
    const s = results.protocols[name].stakeholders.networks;
    lines.push(
      [
        ("  " + (PROTOCOL_LABELS[name] || name)).padEnd(17),
        formatInt(s.totalRelayMessages).padStart(15),
        formatInt(s.totalFanOutToClients).padStart(20),
        formatInt(s.totalRoutingState).padStart(15),
        formatInt(s.peerInterestCopies).padStart(15),
      ].join(" ")
    );
  });

  // Apps
  lines.push("");
  lines.push("  Patient Apps");
  lines.push(
    [
      "  Model".padEnd(17),
      "Total subs".padStart(15),
      "Notifs received".padStart(17),
      "Subs/enrolled pt".padStart(18),
    ].join(" ")
  );
  (["A", "B", "Bp", "C"] as ProtocolName[]).forEach((name) => {
    const s = results.protocols[name].stakeholders.apps;
    lines.push(
      [
        ("  " + (PROTOCOL_LABELS[name] || name)).padEnd(17),
        formatInt(s.totalSubscriptions).padStart(15),
        formatInt(s.totalNotificationsReceived).padStart(17),
        s.meanSubsPerEnrolledPatient.toFixed(1).padStart(18),
      ].join(" ")
    );
  });

  // Payers
  lines.push("");
  lines.push("  Payers");
  lines.push(
    [
      "  Model".padEnd(17),
      "Total subs".padStart(15),
      "Notifs received".padStart(17),
      "Annual churn subs".padStart(19),
      "Ghost subs".padStart(14),
      "Ghost notifs".padStart(14),
    ].join(" ")
  );
  (["A", "B", "Bp", "C"] as ProtocolName[]).forEach((name) => {
    const s = results.protocols[name].stakeholders.payers;
    lines.push(
      [
        ("  " + (PROTOCOL_LABELS[name] || name)).padEnd(17),
        formatInt(s.totalSubscriptions).padStart(15),
        formatInt(s.totalNotificationsReceived).padStart(17),
        formatInt(s.annualChurnSubscriptions).padStart(19),
        formatInt(s.ghostSubscriptions).padStart(14),
        formatInt(s.ghostNotificationsWasted).padStart(14),
      ].join(" ")
    );
  });

  // ─── Direct source sub breakdown ───
  for (const modelName of ["B", "Bp"] as ProtocolName[]) {
    const m = results.protocols[modelName];
    if (m.state.directSourceSubscriptions > 0) {
      lines.push("");
      lines.push(`${PROTOCOL_LABELS[modelName]}: direct source subscription breakdown`);
      lines.push(`  Apps:      ${formatInt(m.state.directSourceSubscriptions_apps)}`);
      lines.push(`  Payers:    ${formatInt(m.state.directSourceSubscriptions_payers)}${modelName === "Bp" ? " (Group subs)" : ""}`);
      lines.push(`  Providers: ${formatInt(m.state.directSourceSubscriptions_providers)}`);
      lines.push(`  Total:     ${formatInt(m.state.directSourceSubscriptions)}`);
      lines.push(`  Ghost:     ${formatInt(m.state.ghostSubscriptions)} (${formatPct(m.state.ghostSubscriptions / Math.max(1, m.state.directSourceSubscriptions))} of active)`);
    }
  }

  return lines.join("\n");
}

function summarizeWorldText(world: WorldSummary): string {
  const lines: string[] = [];
  lines.push("Synthetic ecosystem summary");
  lines.push("");
  lines.push(`Weighted population: ${formatInt(world.weightedPopulation)}`);
  lines.push(`Enrolled patient rate (apps): ${formatPct(world.enrolledPatientRate)}`);
  lines.push(`Mean apps per patient: ${world.meanAppsPerPatient.toFixed(2)}`);
  lines.push(`Mean apps per enrolled patient: ${world.meanAppsPerEnrolledPatient.toFixed(2)}`);
  lines.push(`Payer enrollment rate: ${formatPct(world.payerEnrollmentRate)}`);
  lines.push(`Mean payers per patient: ${world.meanPayersPerPatient.toFixed(2)}`);
  lines.push(
    `Relationships per patient: mean ${world.meanRelationshipsPerPatient.toFixed(2)}, p50 ${world.p50Relationships.toFixed(
      0
    )}, p95 ${world.p95Relationships.toFixed(0)}`
  );
  lines.push(`Mean distinct provider networks per patient: ${world.meanDistinctProviderNetworksPerPatient.toFixed(2)}`);
  lines.push(`Mean episodes per patient: ${world.meanEpisodesPerPatient.toFixed(2)}`);
  lines.push(`Top 5% of patients account for ${formatPct(world.top5PctPatientShareOfEpisodes)} of episodes`);
  lines.push("");
  lines.push("Provider-side network shares");
  world.providerNetworkShares.forEach((x) => {
    lines.push(`  ${x.network}: ${formatPct(x.share)} (${x.archetype})`);
  });
  lines.push("");
  lines.push("App-side network shares");
  world.appNetworkShares.forEach((x) => {
    lines.push(`  ${x.network}: ${formatPct(x.share)} (${x.archetype})`);
  });
  return lines.join("\n");
}

function scenarioMatureAdoption(base: SimulationConfig): SimulationConfig {
  return {
    ...base,
    population: {
      ...base.population,
      appEnrollmentRate: 0.38,
      meanExtraAppsIfEnrolled: 0.40,
    },
  };
}

function scenarioCWorstCaseEncryption(base: SimulationConfig): SimulationConfig {
  return {
    ...base,
    modelC: {
      encryptionMode: "endpoint",
      keyPropagationMode: "all-sources-in-peer-networks",
    },
  };
}

function scenarioHighFragmentation(base: SimulationConfig): SimulationConfig {
  const cohorts = base.population.cohorts.map((c) => ({
    ...c,
    fragmentationAlpha: c.fragmentationAlpha + 1.0,
    fragmentationBeta: Math.max(1.5, c.fragmentationBeta - 0.6),
    meanBaselineRelationships: c.meanBaselineRelationships * 1.15,
  }));
  return {
    ...base,
    population: {
      ...base.population,
      cohorts,
    },
  };
}


function scenarioCrossNetworkMix(base: SimulationConfig): SimulationConfig {
  return {
    ...base,
    networks: {
      ...base.networks,
      sameNetworkAppProbability: 0.15,
      multiAppSameNetworkProbability: 0.55,
      newRelationshipExistingNetworkProbability: 0.38,
      homeProviderNetworkProbability: 0.45,
    },
  };
}

function scenarioHighPayerChurn(base: SimulationConfig): SimulationConfig {
  return {
    ...base,
    payers: {
      ...base.payers,
      monthlyMemberChurnRate: 0.05,
    },
    modelB: {
      ...base.modelB,
      deactivationFailureRate: 0.10,
    },
  };
}

function runScenario(name: string, config: SimulationConfig): { name: string; results: AllResults } {
  const world = buildWorld(config);
  const results = runAll(world);
  return { name, results };
}

function main(): void {
  const base = createDefaultConfig();
  const scenarios: Array<[string, SimulationConfig]> = [
    ["baseline", base],
    ["mature-adoption", scenarioMatureAdoption(base)],
    ["high-fragmentation", scenarioHighFragmentation(base)],
    ["cross-network-mix", scenarioCrossNetworkMix(base)],
    ["high-payer-churn", scenarioHighPayerChurn(base)],
  ];

  for (const [name, cfg] of scenarios) {
    const scenario = runScenario(name, cfg);
    console.log("=".repeat(100));
    console.log(`Scenario: ${scenario.name}`);
    console.log("-".repeat(100));
    console.log(summarizeWorldText(scenario.results.world));
    console.log("");
    console.log(compareProtocols(scenario.results));
    console.log("");
  }
}

if (require.main === module) {
  main();
}

export {
  createDefaultConfig,
  buildWorld,
  runAll,
  PROTOCOL_LABELS,
  scenarioMatureAdoption,
  scenarioHighFragmentation,
  scenarioCWorstCaseEncryption,
  scenarioCrossNetworkMix,
  scenarioHighPayerChurn,
  type SimulationConfig,
  type SyntheticWorld,
  type AllResults,
  type ProtocolName,
};
