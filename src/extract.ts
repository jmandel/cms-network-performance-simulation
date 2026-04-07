import type { ModelId } from "./constants";

export interface ExtractedProtocol {
  dataPlaneMessages: number;
  controlPlaneMessages: number;
  totalMessages: number;
  dataPlaneBytes: number;
  controlPlaneBytes: number;
  directSourceSubs: number;
  directSourceSubs_apps: number;
  directSourceSubs_payers: number;
  directSourceSubs_providers: number;
  ghostSubs: number;
  appToNetworkSubs: number;
  payerToNetworkSubs: number;
  peerInterest: number;
  keysAtSources: number;
  src_meanSubs: number;
  src_p95Subs: number;
  src_meanMsgsDay: number;
  src_p95MsgsDay: number;
  src_outbound: number;
  src_auth: number;
  src_subsManaged: number;
  net_relay: number;
  net_fanout: number;
  net_routingState: number;
  net_peerInterest: number;
  app_totalSubs: number;
  app_notifs: number;
  app_subsPerPt: number;
  payer_totalSubs: number;
  payer_notifs: number;
  payer_churn: number;
  payer_ghost: number;
  payer_ghostNotifs: number;
  meanDailyMessages: number;
  p95DailyMessages: number;
}

export interface SweepData {
  scenarios: Record<string, { world: any; protocols: Record<ModelId, ExtractedProtocol> }>;
  sweeps: Record<string, Array<{ param: number; label: string } & Record<ModelId, ExtractedProtocol>>>;
  labels: Record<ModelId, string>;
}

/** Extract flat metrics from a full AllResults object (for live sim results) */
export function extractFromAllResults(r: any): Record<ModelId, ExtractedProtocol> {
  const out: any = {};
  for (const m of ["A", "B", "Bp", "C"]) {
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
