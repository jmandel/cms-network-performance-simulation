import { createRoot } from "react-dom/client";
import React, { useEffect } from "react";
import { useStore } from "./store";
import { MODEL_IDS, MODEL_LABELS, MODEL_COLORS, ENTITY_COLORS, fmt, ff } from "./constants";
import type { ModelId } from "./constants";
import type { ExtractedProtocol, NumericBand, ScenarioBundle } from "./extract";
import { HBar } from "./components/charts/HBar";
import { Donut } from "./components/charts/Donut";
import { createDefaultConfig } from "../fhir_network_sim";

const DEFAULTS = createDefaultConfig();

// ── Shared tiny components ──

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <div className="container">{children}</div>
    </section>
  );
}

function Callout({ variant, children }: { variant: "info" | "warn" | "bad" | "good"; children: React.ReactNode }) {
  return <div className={`callout ${variant}`}>{children}</div>;
}

function MetricCard({ value, label, color, formatter = fmt }: { value: number; label: string; color: string; formatter?: (n: number) => string }) {
  return (
    <div className="metric-box" style={{ borderTop: `3px solid ${color}` }}>
      <div className="num" style={{ color }}>{formatter(value)}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

function fmtRange(band: NumericBand | undefined, formatter: (n: number) => string = fmt): string {
  if (!band) return "n/a";
  return `${formatter(band.p50)} [${formatter(band.p10)}-${formatter(band.p90)}]`;
}

function winnerText(models: ModelId[]): string {
  return models.map((m) => MODEL_LABELS[m]).join(" / ");
}

// ── Hero ──

function Hero() {
  const baselineWorld = useStore((s) => s.baselineWorld);
  return (
    <div className="hero">
      <div className="container">
        <h1>FHIR Subscription Architecture</h1>
        <div className="sub">Comparing four notification architectures at U.S. scale</div>
        <div className="meta">
          CMS Subscriptions Workgroup · Simulation: {baselineWorld ? fmt(baselineWorld.weightedPopulation) : fmt(DEFAULTS.population.usPopulation)} population, {ff(DEFAULTS.sources.totalOrganizations)} TEFCA-scale orgs, {DEFAULTS.payers.totalPayers} payers ·{" "}
          <a href="#methodology" style={{ color: "#93bbfd" }}>Methodology</a>
        </div>
      </div>
    </div>
  );
}

// ── Nav ──

function Nav() {
  const links = [
    ["#architectures", "Architectures"],
    ["#finding1", "Total Work"],
    ["#finding2", "Who Does It"],
    ["#finding3", "Payer Impact"],
    ["#tradeoffs", "Tradeoffs"],
    ["#sensitivity", "Sensitivity"],
    ["#methodology", "Methodology"],
    ["#explorer", "Explorer"],
  ];
  return (
    <nav>
      <div className="container">
        {links.map(([href, label]) => (
          <a key={href} href={href} style={label === "Explorer" ? { background: "#eff6ff", color: "#2563eb", fontWeight: 600 } : undefined}>
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

// ── Tooltip ──

function Tooltip() {
  const tooltip = useStore((s) => s.tooltip);
  if (!tooltip) return null;
  return (
    <div
      className="tooltip"
      style={{ display: "block", left: tooltip.x + 12, top: tooltip.y - 10 }}
      dangerouslySetInnerHTML={{ __html: tooltip.html }}
    />
  );
}

// ── Architectures ──

function Architectures() {
  const archs: { id: ModelId; name: string; desc: string }[] = [
    { id: "A", name: "Subscriptions Broker", desc: "One subscription per client at the Broker. Networks route everything. Sources have one connection." },
    { id: "B", name: "Per-Patient Source Feed", desc: "Clients subscribe directly at each source. Networks only signal new care relationships." },
    { id: "Bp", name: "Source Feed + Group Subs", desc: "Like Direct, but payers use one Group per source (DaVinci ATR) instead of per-patient subscriptions." },
    { id: "C", name: "Encrypted Relay", desc: "Broker routing with end-to-end encryption. Networks relay without reading content." },
  ];
  return (
    <Section id="architectures">
      <h2>Four Architectures</h2>
      <div className="g4">
        {archs.map((a) => (
          <div key={a.id} className={`arch ${a.id === "Bp" ? "bp" : a.id.toLowerCase()}`}>
            <span className={`tag tag-${a.id === "Bp" ? "bp" : a.id.toLowerCase()}`}>{MODEL_LABELS[a.id]}</span>
            <strong>{a.name}</strong>
            <p>{a.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Finding 1: Total Work ──

function Finding1() {
  const B = useStore((s) => s.baseline);
  const sweepData = useStore((s) => s.sweepData);
  if (!B) return null;
  const savings = B.A.totalMessages - B.B.totalMessages;
  const reductionPct = Math.round((savings / B.A.totalMessages) * 100);
  const directWins = sweepData?.scenarioBundles
    ? sweepData.scenarioBundles.filter((bundle) => {
        const best = Math.min(
          bundle.protocols.A.totalMessages,
          bundle.protocols.B.totalMessages,
          bundle.protocols.Bp.totalMessages,
          bundle.protocols.C.totalMessages
        );
        return bundle.protocols.B.totalMessages <= best * 1.000001;
      }).length
    : null;
  return (
    <Section id="finding1">
      <h2>Total Work: Direct Models Do Less</h2>
      <p>All four architectures deliver the same notifications to the same consumers. The question is how many intermediate messages the system needs. Direct removes relay hops, cutting total messages by about {reductionPct}% in baseline and staying lowest across {directWins ?? "all"} tested scenario bundles.</p>
      <div className="metric-row">
        {MODEL_IDS.map((m) => (
          <MetricCard key={m} value={B[m].totalMessages} label={`${MODEL_LABELS[m]} — total messages/yr`} color={MODEL_COLORS[m]} />
        ))}
      </div>
      <Callout variant="info">
        <strong>Why the difference?</strong> In Broker, every clinical event traverses source→network→peer network→client. Each hop is a message. In Direct, sources send straight to subscribers — no relay. The <strong>{fmt(savings)}</strong> eliminated messages are relay hops duplicating data through network infrastructure. Both Direct variants are identical here — Group subscriptions change management, not delivery.
      </Callout>
    </Section>
  );
}

// ── Finding 2: Who Does the Work ──

function Finding2() {
  const B = useStore((s) => s.baseline);
  const sweepData = useStore((s) => s.sweepData);
  if (!B) return null;
  const directP95Min = sweepData?.scenarioBundles?.length
    ? Math.min(...sweepData.scenarioBundles.map((bundle) => bundle.protocols.B.src_p95Subs))
    : null;
  const directP95Max = sweepData?.scenarioBundles?.length
    ? Math.max(...sweepData.scenarioBundles.map((bundle) => bundle.protocols.B.src_p95Subs))
    : null;
  return (
    <Section id="finding2">
      <h2>Who Does the Work</h2>
      <p>Direct reduces total work but shifts burden from networks to individual provider sites. In Broker, a source sends one message to its network. In Direct, that source manages subscriptions from every app, payer, and care-team member.</p>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Where the work lands: source outbound vs network relay (annual)</h3>
        <p style={{ fontSize: ".82rem", color: "var(--muted)", marginBottom: 10 }}>
          Each bar shows one architecture. In Broker/Encrypted, networks carry most of the load. In Direct models, sources send directly to subscribers.
        </p>
        <HBar
          metrics={[
            { label: "Source outbound msgs/yr", key: "src_outbound" },
            { label: "Network relay msgs/yr", key: "net_relay" },
          ]}
          data={B}
        />
      </div>
      <Callout variant="warn">
        <strong>Adoption question:</strong> A p95 source in Direct manages <strong>{ff(B.B.src_p95Subs)}</strong> subscriptions and sends <strong>{ff(B.B.src_p95MsgsDay)}</strong> msgs/day. Across scenario bundles, that p95 subscription burden stays in the <strong>{directP95Min ? ff(directP95Min) : "n/a"}-{directP95Max ? ff(directP95Max) : "n/a"}</strong> range. Direct+Group reduces subs to <strong>{ff(B.Bp.src_p95Subs)}</strong>. Broker requires <strong>zero</strong> subscription management — sources send <strong>{ff(B.A.src_p95MsgsDay)}</strong> msgs/day to their network only.
      </Callout>
    </Section>
  );
}

// ── Finding 3: Payer Impact ──

function Finding3() {
  const B = useStore((s) => s.baseline);
  const sweepData = useStore((s) => s.sweepData);
  if (!B) return null;
  const baselineShare = Math.round((B.B.directSourceSubs_payers / B.B.directSourceSubs) * 100);
  const payerShareMin = sweepData?.scenarioBundles?.length
    ? Math.min(
        ...sweepData.scenarioBundles.map((bundle) =>
          (bundle.protocols.B.directSourceSubs_payers / bundle.protocols.B.directSourceSubs) * 100
        )
      )
    : null;
  const payerShareMax = sweepData?.scenarioBundles?.length
    ? Math.max(
        ...sweepData.scenarioBundles.map((bundle) =>
          (bundle.protocols.B.directSourceSubs_payers / bundle.protocols.B.directSourceSubs) * 100
        )
      )
    : null;
  return (
    <Section id="finding3">
      <h2>Payer Subscription Burden</h2>
      <p>Payers account for <strong>{baselineShare}%</strong> of Direct's source subscription state in baseline, and stay in the <strong>{payerShareMin ? `${Math.round(payerShareMin)}-${Math.round(payerShareMax!)}%` : "n/a"}</strong> range across tested bundles. This is where the architectural choice matters most.</p>

      <div className="g2" style={{ marginBottom: 16 }}>
        <div className="card" style={{ textAlign: "center", borderTop: `3px solid ${MODEL_COLORS.A}` }}>
          <div className="num" style={{ color: MODEL_COLORS.A, fontSize: "1.8rem", fontWeight: 700 }}>{fmt(B.A.payer_totalSubs)}</div>
          <div className="lbl">Broker — payer subscriptions (all at Broker)</div>
        </div>
        <div className="card" style={{ textAlign: "center", borderTop: `3px solid ${MODEL_COLORS.B}` }}>
          <div className="num" style={{ color: MODEL_COLORS.B, fontSize: "1.8rem", fontWeight: 700 }}>{fmt(B.B.payer_totalSubs)}</div>
          <div className="lbl">Direct — payer subscriptions (Broker + every source)</div>
        </div>
      </div>

      <div className="g2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Direct: who are those {fmt(B.B.directSourceSubs)} source subs?</h3>
          <Donut
            segments={[
              { label: "Apps", value: B.B.directSourceSubs_apps, color: ENTITY_COLORS.apps },
              { label: "Payers", value: B.B.directSourceSubs_payers, color: ENTITY_COLORS.payers },
              { label: "Providers", value: B.B.directSourceSubs_providers, color: ENTITY_COLORS.providers },
            ]}
            total={B.B.directSourceSubs}
            centerLabel="source subs"
          />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Direct+Group: payer subs collapse to Group subs</h3>
          <Donut
            segments={[
              { label: "Apps", value: B.Bp.directSourceSubs_apps, color: ENTITY_COLORS.apps },
              { label: "Payers", value: B.Bp.directSourceSubs_payers, color: ENTITY_COLORS.payers },
              { label: "Providers", value: B.Bp.directSourceSubs_providers, color: ENTITY_COLORS.providers },
            ]}
            total={B.Bp.directSourceSubs}
            centerLabel="source subs"
          />
        </div>
      </div>

      <Callout variant="warn">
        <strong>Stale subscription risk (Direct):</strong> When a member changes plans, subscriptions must be deactivated at every source. If {fmt(B.B.payer_churn)} annual deactivations have even a modest failure rate (simulated at 5%), <strong>{fmt(B.B.ghostSubs)} stale subs accumulate/yr</strong>. Sources can mitigate this with subscription TTLs, periodic reconciliation, or heartbeat-based expiry — but these add operational complexity that Broker and Encrypted avoid entirely, since subscription lifecycle is managed at the network level.
      </Callout>
      <Callout variant="good">
        <strong>Direct+Group changes the payer problem:</strong> Payer source subs collapse from <strong>{fmt(B.B.directSourceSubs_payers)}</strong> per-patient subscriptions to <strong>{fmt(B.Bp.directSourceSubs_payers)}</strong> Group subs. In this simulator, the main credited benefit is the collapse in active payer-side source state; ghost cleanup remains scenario-sensitive and is not assumed away.
      </Callout>
    </Section>
  );
}

// ── Tradeoff Table ──

function TradeoffTable() {
  const B = useStore((s) => s.baseline);
  if (!B) return null;
  const dims: [string, Record<ModelId, string>, string][] = [
    ["Active source subs", { A: fmt(B.A.directSourceSubs), B: fmt(B.B.directSourceSubs), Bp: fmt(B.Bp.directSourceSubs), C: fmt(B.C.directSourceSubs) }, "A,C"],
    ["Source outbound msgs/day (p95)", { A: ff(B.A.src_p95MsgsDay), B: ff(B.B.src_p95MsgsDay), Bp: ff(B.Bp.src_p95MsgsDay), C: ff(B.C.src_p95MsgsDay) }, "A"],
    ["Total messages/yr", { A: fmt(B.A.totalMessages), B: fmt(B.B.totalMessages), Bp: fmt(B.Bp.totalMessages), C: fmt(B.C.totalMessages) }, "B,Bp"],
    ["Network relay msgs/yr", { A: fmt(B.A.net_relay), B: fmt(B.B.net_relay), Bp: fmt(B.Bp.net_relay), C: fmt(B.C.net_relay) }, "B,Bp"],
    ["Payer active subs", { A: fmt(B.A.payer_totalSubs), B: fmt(B.B.payer_totalSubs), Bp: fmt(B.Bp.payer_totalSubs), C: fmt(B.C.payer_totalSubs) }, "A,Bp,C"],
    ["Payer churn ops/yr", { A: fmt(B.A.payer_churn), B: fmt(B.B.payer_churn), Bp: fmt(B.Bp.payer_churn), C: fmt(B.C.payer_churn) }, "A,Bp,C"],
    ["Stale subs accumulated/yr", { A: "None", B: fmt(B.B.ghostSubs), Bp: fmt(B.Bp.ghostSubs), C: "None" }, "A,C"],
    ["App subs per enrolled patient", { A: B.A.app_subsPerPt.toFixed(1), B: B.B.app_subsPerPt.toFixed(1), Bp: B.Bp.app_subsPerPt.toFixed(1), C: B.C.app_subsPerPt.toFixed(1) }, "A,C"],
    ["Privacy (network cannot read)", { A: "No", B: "N/A", Bp: "N/A", C: "Yes" }, "C"],
  ];
  return (
    <Section id="tradeoffs">
      <h2>Tradeoff Summary</h2>
      <p>No architecture dominates all dimensions. Direct reduces total work but shifts burden to sources. Direct+Group reclaims payer efficiency while keeping Direct's message savings. Encrypted adds privacy at highest total cost.</p>
      <table>
        <thead>
          <tr>
            <th>Dimension</th>
            {MODEL_IDS.map((m) => (
              <th key={m} style={{ color: MODEL_COLORS[m] }}>{MODEL_LABELS[m]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dims.map(([dim, vals, best]) => (
            <tr key={dim}>
              <td>{dim}</td>
              {MODEL_IDS.map((m) => (
                <td key={m} style={{ color: MODEL_COLORS[m], fontWeight: best.split(",").includes(m) ? 700 : 400, opacity: best.split(",").includes(m) ? 1 : 0.7 }}>
                  {vals[m]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <details>
        <summary>Scenario sensitivity</summary>
        <p><a href="#sensitivity">Sensitivity</a> shows p10/p50/p90 ranges and winner stability across multi-seed scenario bundles. The <a href="#explorer">Explorer</a> supports custom parameter combinations.</p>
      </details>
    </Section>
  );
}

function Sensitivity() {
  const sweepData = useStore((s) => s.sweepData);
  if (!sweepData?.scenarioBundles?.length) return null;

  const bundles = sweepData.scenarioBundles;
  const directWins = bundles.filter((bundle) => {
    const best = Math.min(
      bundle.protocols.A.totalMessages,
      bundle.protocols.B.totalMessages,
      bundle.protocols.Bp.totalMessages,
      bundle.protocols.C.totalMessages
    );
    return bundle.protocols.B.totalMessages <= best * 1.000001;
  }).length;
  const sourceWins = bundles.filter((bundle) => {
    const best = Math.min(
      bundle.protocols.A.src_p95Subs,
      bundle.protocols.B.src_p95Subs,
      bundle.protocols.Bp.src_p95Subs,
      bundle.protocols.C.src_p95Subs
    );
    return bundle.protocols.A.src_p95Subs <= best * 1.000001;
  }).length;
  const payerMinDirect = Math.min(...bundles.map((bundle) => bundle.protocols.B.directSourceSubs_payers));
  const payerMaxDirect = Math.max(...bundles.map((bundle) => bundle.protocols.B.directSourceSubs_payers));
  const payerMinGroup = Math.min(...bundles.map((bundle) => bundle.protocols.Bp.directSourceSubs_payers));
  const payerMaxGroup = Math.max(...bundles.map((bundle) => bundle.protocols.Bp.directSourceSubs_payers));
  const worstGhost = Math.max(...bundles.map((bundle) => bundle.protocols.B.ghostSubs));
  const encryptionStress = bundles.find((bundle) => bundle.id === "c-encryption-stress");

  return (
    <Section id="sensitivity">
      <h2>Scenario Bundles</h2>
      <p>Each bundle is run across <strong>{sweepData.meta.seeds.length}</strong> seeds at <strong>{ff(sweepData.meta.samplePatients)}</strong> sampled patients. Values below show medians with p10-p90 ranges, which are more decision-useful than a single world draw.</p>
      <Callout variant="info">
        <strong>Key messages:</strong> Direct has the lowest total-message count in <strong>{directWins}/{bundles.length}</strong> bundles. Broker keeps source subscription burden lowest in <strong>{sourceWins}/{bundles.length}</strong>. Direct+Group cuts payer source state from roughly <strong>{fmt(payerMinDirect)}-{fmt(payerMaxDirect)}</strong> per-patient subscriptions to about <strong>{fmt(payerMinGroup)}-{fmt(payerMaxGroup)}</strong> Group subscriptions, while high-churn bundles still push Direct ghost subscriptions as high as <strong>{fmt(worstGhost)}</strong>. {encryptionStress ? `Under the encryption-stress bundle, Encrypted reaches ${fmt(encryptionStress.protocols.C.totalMessages)} total messages/yr.` : ""}
      </Callout>
      <table>
        <thead>
          <tr>
            <th>Bundle</th>
            <th>Total msg winner</th>
            <th>Direct total msgs</th>
            <th>Direct p95 subs/source</th>
            <th>Direct payer subs</th>
            <th>Direct+Group payer subs</th>
          </tr>
        </thead>
        <tbody>
          {bundles.map((bundle: ScenarioBundle) => (
            <tr key={bundle.id}>
              <td>
                <strong>{bundle.label}</strong>
                <div style={{ fontSize: ".78rem", color: "var(--muted)", marginTop: 4 }}>{bundle.description}</div>
              </td>
              <td>{winnerText(bundle.winners.totalMessages)}</td>
              <td style={{ color: MODEL_COLORS.B }}>{fmtRange(bundle.protocolBands.B.totalMessages)}</td>
              <td style={{ color: MODEL_COLORS.B }}>{fmtRange(bundle.protocolBands.B.src_p95Subs)}</td>
              <td style={{ color: MODEL_COLORS.B }}>{fmtRange(bundle.protocolBands.B.directSourceSubs_payers)}</td>
              <td style={{ color: MODEL_COLORS.Bp }}>{fmtRange(bundle.protocolBands.Bp.directSourceSubs_payers)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

// ── Methodology ──

function Methodology() {
  const baselineWorld = useStore((s) => s.baselineWorld);
  const sweepData = useStore((s) => s.sweepData);
  return (
    <Section id="methodology">
      <h2>Methodology</h2>
      <p>A TypeScript simulator generates a synthetic U.S.-scale ecosystem and counts every message, subscription, and state record for each architecture.</p>
      <div className="g2">
        <div>
          <h3>Synthetic ecosystem</h3>
          <table>
            <tbody>
              <tr><td>Population</td><td>{baselineWorld ? `${fmt(baselineWorld.weightedPopulation)} simulated population` : fmt(DEFAULTS.population.usPopulation)}</td></tr>
              <tr><td>Networks</td><td>{DEFAULTS.networks.count} (QHIN-scale, Zipf-distributed sizes)</td></tr>
              <tr><td>Organizations</td><td>{ff(DEFAULTS.sources.totalOrganizations)} TEFCA-scale orgs</td></tr>
              <tr><td>Patient apps</td><td>{(DEFAULTS.population.appEnrollmentRate * 100).toFixed(0)}% enrollment, {DEFAULTS.apps.totalVendors} vendors</td></tr>
              <tr><td>Payers</td><td>{(DEFAULTS.payers.enrollmentRate * 100).toFixed(0)}% enrollment, {DEFAULTS.payers.totalPayers} payers, {(DEFAULTS.payers.monthlyMemberChurnRate * 100).toFixed(1)}%/mo churn</td></tr>
              <tr><td>Relationships</td><td>{baselineWorld ? `Mean ${baselineWorld.meanRelationshipsPerPatient.toFixed(2)}/patient (p95: ${baselineWorld.p95Relationships.toFixed(0)})` : "Synthetic heavy-tailed relationships"}</td></tr>
              <tr><td>Episodes</td><td>{baselineWorld ? `Mean ${baselineWorld.meanEpisodesPerPatient.toFixed(2)}/patient/year` : "Synthetic annual utilization"}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3>Key assumptions</h3>
          <table>
            <tbody>
              <tr><td>Notification copies</td><td>Outpatient: {DEFAULTS.events.outpatientScheduledMultiplier + DEFAULTS.events.outpatientCompletedNotifications}, ED: {DEFAULTS.events.edNotifications}, Inpatient: {DEFAULTS.events.inpatientAdmissionNotifications + DEFAULTS.events.inpatientDischargeNotifications}</td></tr>
              <tr><td>Peer multiplexing</td><td>1 event per patient, not per client</td></tr>
              <tr><td>Deactivation failure</td><td>{(DEFAULTS.modelB.deactivationFailureRate * 100).toFixed(0)}% (Direct models)</td></tr>
              <tr><td>Group subs</td><td>1 per payer-source pair</td></tr>
              <tr><td>Payload</td><td>{ff(DEFAULTS.events.payloadBytes.clinicalNotification)} bytes/notification</td></tr>
              <tr><td>Scenario bundles</td><td>{sweepData ? `${sweepData.meta.bundleCount} bundles × ${sweepData.meta.seeds.length} seeds` : "Multi-seed bundles"}</td></tr>
            </tbody>
          </table>
          <h3>Not modeled</h3>
          <p style={{ fontSize: ".82rem" }}>Implementation complexity, latency, fault tolerance, cost per message, and detailed Group query overhead at sources. The scenario bundles improve robustness, but this remains a decision-support simulator rather than a forecast model.</p>
        </div>
      </div>
    </Section>
  );
}

// ── Explorer ──

function Explorer() {
  const { sliders, setSlider, runSimulation, isSimRunning, simStatus, explorerResults } = useStore();

  useEffect(() => {
    useStore.getState().init();
  }, []);

  const [helpExpanded, setHelpExpanded] = React.useState(false);

  const sl = (
    key: keyof typeof sliders,
    label: string,
    desc: string,
    help: string,
    min: number, max: number, step: number,
    display: (v: number) => string,
  ) => (
    <div className="slider-group">
      <label>
        {label}
        <span style={{ color: "var(--muted)", fontWeight: 400 }}>{display(sliders[key])}</span>
      </label>
      <div style={{ fontSize: ".75rem", color: "var(--muted)", marginBottom: 4 }}>
        {desc}
        {!helpExpanded && (
          <>
            {" "}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setHelpExpanded(true); }}
              style={{ color: "var(--broker)", textDecoration: "none", fontWeight: 600 }}
            >…more</a>
          </>
        )}
      </div>
      {helpExpanded && (
        <div style={{
          fontSize: ".75rem", color: "var(--text)", background: "#f0f4ff",
          padding: "8px 10px", borderRadius: 6, marginBottom: 6, lineHeight: 1.5,
        }}>{help}</div>
      )}
      <input type="range" min={min} max={max} step={step} value={sliders[key]} onChange={(e) => setSlider(key, parseFloat(e.target.value))} />
    </div>
  );

  return (
    <Section id="explorer">
      <h2>Interactive Explorer</h2>
      <p>Run the full simulation in your browser. Adjust parameters and compare all four architectures.</p>
      <div className="explorer-grid">
        <div className="explorer-controls card">
          {helpExpanded && (
            <div style={{ textAlign: "right", marginBottom: 8 }}>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setHelpExpanded(false); }}
                style={{ color: "var(--broker)", fontSize: ".75rem", textDecoration: "none", fontWeight: 600 }}
              >hide details</a>
            </div>
          )}
          {sl("appEnrollmentRate", "App enrollment",
            "Fraction of patients using a health app",
            "What share of patients have at least one FHIR-connected health app (e.g., Apple Health, patient portal app). Higher enrollment means more app subscriptions at sources in Direct models. Current real-world estimate is ~7% based on ONC 2024 data; slider lets you test future adoption scenarios.",
            0.02, 0.7, 0.01, (v) => `${(v * 100).toFixed(0)}%`)}
          {sl("payerEnrollmentRate", "Payer enrollment",
            "Fraction of patients with payer subscription coverage",
            "What share of patients have at least one payer (insurer) that subscribes for notifications. Includes commercial, Medicare, and Medicaid. ~92% of the U.S. population has some form of health coverage. Payers are the largest driver of subscription volume in Direct models.",
            0.1, 0.99, 0.01, (v) => `${(v * 100).toFixed(0)}%`)}
          {sl("payerMonthlyChurn", "Payer monthly churn",
            "Monthly rate at which members change payers",
            "Each month, this fraction of payer-patient relationships end (job changes, open enrollment, Medicaid redetermination) and new ones begin. In Direct models, each change requires subscription operations at every source the patient visits. Higher churn amplifies control-plane load and ghost subscription risk.",
            0.005, 0.15, 0.005, (v) => `${(v * 100).toFixed(1)}%`)}
          {sl("appAnnualChurn", "App annual churn",
            "Annual rate at which patients switch or drop apps",
            "The fraction of app-patient relationships that turn over per year. When a patient uninstalls an app, subscriptions at the Broker (all models) and at each source (Direct models) must be deactivated. Lower impact than payer churn because fewer patients have apps.",
            0.02, 0.5, 0.01, (v) => `${(v * 100).toFixed(0)}%`)}
          {sl("deactivationFailure", "Deactivation failure",
            "Probability a subscription delete fails (Direct models)",
            "When a subscription should be removed at a source but the delete fails (network issues, source downtime, bugs), the source retains a stale subscription and continues sending notifications. Only affects Direct and Direct+Group. In practice, TTLs, periodic reconciliation, or heartbeat-based expiry can clean these up — this slider models the residual rate after such mitigations.",
            0, 0.3, 0.01, (v) => `${(v * 100).toFixed(0)}%`)}
          {sl("relationshipMult", "Relationship multiplier",
            "Scales the average number of provider relationships per patient",
            "Multiplies the baseline number of care relationships (default: mean ~2.2 per patient). At 1.5x, patients average ~3.3 providers. More relationships means more source subscriptions in Direct models. Simulates care fragmentation — higher values model populations that see more distinct providers.",
            0.5, 2.5, 0.1, (v) => `${v.toFixed(1)}x`)}
          {sl("samplePatients", "Sample patients",
            "Number of patients simulated (scaled to 342M)",
            "The simulator generates this many individual patients, then multiplies all counts by a weight to project to the full U.S. population. Higher values give more stable results but take longer to run. 20K is fast (~1s); 120K matches the pre-computed baseline.",
            5000, 120000, 5000, (v) => Math.round(v).toLocaleString())}
          <button className="run-btn" disabled={isSimRunning} onClick={runSimulation}>Run Simulation</button>
          <div className="sim-status">{simStatus}</div>
        </div>
        <div>
          {explorerResults ? <ExplorerResults data={explorerResults} /> : (
            <div className="sim-status" style={{ padding: "60px 0" }}>Loading simulator...</div>
          )}
        </div>
      </div>
    </Section>
  );
}

function ExplorerResults({ data }: { data: Record<ModelId, ExtractedProtocol> }) {
  const rows: [string | null, ((m: ModelId) => number) | null][] = [
    ["Total messages/yr", (m) => data[m].totalMessages],
    ["Data plane msgs/yr", (m) => data[m].dataPlaneMessages],
    ["Control plane msgs/yr", (m) => data[m].controlPlaneMessages],
    ["---1", null],
    ["Direct source subs (active)", (m) => data[m].directSourceSubs],
    ["  — Apps", (m) => data[m].directSourceSubs_apps],
    ["  — Payers", (m) => data[m].directSourceSubs_payers],
    ["  — Providers", (m) => data[m].directSourceSubs_providers],
    ["Stale subs (accumulated/yr)", (m) => data[m].ghostSubs],
    ["---2", null],
    ["P95 subs/source (active)", (m) => data[m].src_p95Subs],
    ["P95 msgs/source/day", (m) => data[m].src_p95MsgsDay],
    ["---3", null],
    ["Payer subs (active)", (m) => data[m].payer_totalSubs],
    ["Payer churn ops/yr", (m) => data[m].payer_churn],
    ["Payer stale subs/yr", (m) => data[m].payer_ghost],
  ];
  return (
    <table style={{ fontSize: ".8rem" }}>
      <thead>
        <tr>
          <th>Metric</th>
          {MODEL_IDS.map((m) => (
            <th key={m} style={{ color: MODEL_COLORS[m] }}>{MODEL_LABELS[m]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, fn], i) => {
          if (!fn) return <tr key={`sep-${i}`}><td colSpan={5} style={{ border: "none", height: 4 }} /></tr>;
          return (
            <tr key={`row-${label}`}>
              <td>{label}</td>
              {MODEL_IDS.map((m) => (
                <td key={m} style={{ color: MODEL_COLORS[m] }}>{ff(fn(m))}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── App ──

function App() {
  return (
    <>
      <Hero />
      <Nav />
      <Tooltip />
      <Architectures />
      <Finding1 />
      <Finding2 />
      <Finding3 />
      <TradeoffTable />
      <Sensitivity />
      <Methodology />
      <Explorer />
    </>
  );
}

// ── Mount ──
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
