import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { useStore } from "./store";
import { MODEL_IDS, MODEL_LABELS, MODEL_COLORS, ENTITY_COLORS, fmt, ff } from "./constants";
import type { ModelId } from "./constants";
import type { ExtractedProtocol } from "./extract";
import { HBar } from "./components/charts/HBar";
import { Donut } from "./components/charts/Donut";

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

// ── Hero ──

function Hero() {
  return (
    <div className="hero">
      <div className="container">
        <h1>FHIR Subscription Architecture</h1>
        <div className="sub">Comparing four notification architectures at U.S. scale</div>
        <div className="meta">
          CMS Subscriptions Workgroup · Simulation: 342M population, 12K providers, 15 payers ·{" "}
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
  if (!B) return null;
  const savings = B.A.totalMessages - B.B.totalMessages;
  return (
    <Section id="finding1">
      <h2>Total Work: Direct Models Do Less</h2>
      <p>All four architectures deliver the same notifications to the same consumers. The question is how many intermediate messages the system needs. Direct models eliminate network relay hops, reducing total messages by ~34%.</p>
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
  if (!B) return null;
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
            { label: "Source outbound msgs", key: "src_outbound" },
            { label: "Network relay msgs", key: "net_relay" },
          ]}
          data={B}
        />
      </div>
      <Callout variant="warn">
        <strong>Adoption question:</strong> A p95 source in Direct manages <strong>{ff(B.B.src_p95Subs)}</strong> subscriptions and sends <strong>{ff(B.B.src_p95MsgsDay)}</strong> msgs/day. Direct+Group reduces subs to <strong>{ff(B.Bp.src_p95Subs)}</strong> (payer per-patient subs collapse to Group subs). Broker requires <strong>zero</strong> subscription management — sources send <strong>{ff(B.A.src_p95MsgsDay)}</strong> msgs/day to their network only.
      </Callout>
    </Section>
  );
}

// ── Finding 3: Payer Impact ──

function Finding3() {
  const B = useStore((s) => s.baseline);
  if (!B) return null;
  return (
    <Section id="finding3">
      <h2>Payer Subscription Burden</h2>
      <p>With 90% coverage and mean 2.19 sources per patient, payers account for <strong>62%</strong> of Direct's source subscription state. This is where the architectural choice matters most for payers.</p>

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
          <h3 style={{ marginTop: 0 }}>Direct: who are those 1.5B source subs?</h3>
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

      <Callout variant="bad">
        <strong>Ghost subscription risk (Direct):</strong> When a member changes plans, subscriptions must be deactivated at every source. At 5% failure rate, <strong>{fmt(B.B.ghostSubs)}</strong> ghost subs accumulate — notifications sent to payers who no longer cover the patient.
      </Callout>
      <Callout variant="good">
        <strong>Direct+Group mitigates this:</strong> Payer subs collapse from <strong>959M</strong> per-patient subscriptions to <strong>~180K</strong> long-lived Group subs. Member churn becomes Group membership ops, not subscription CRUD. Payer burden approaches Broker while preserving Direct's lower message volume.
      </Callout>
    </Section>
  );
}

// ── Tradeoff Table ──

function TradeoffTable() {
  const B = useStore((s) => s.baseline);
  if (!B) return null;
  const dims: [string, Record<ModelId, string>, string][] = [
    ["Source subscription burden", { A: "0", B: "1.5B", Bp: "579M", C: "0" }, "A,C"],
    ["Source outbound msgs/day (p95)", { A: ff(B.A.src_p95MsgsDay), B: ff(B.B.src_p95MsgsDay), Bp: ff(B.Bp.src_p95MsgsDay), C: ff(B.C.src_p95MsgsDay) }, "A"],
    ["Total annual messages", { A: fmt(B.A.totalMessages), B: fmt(B.B.totalMessages), Bp: fmt(B.Bp.totalMessages), C: fmt(B.C.totalMessages) }, "B,Bp"],
    ["Network relay messages", { A: fmt(B.A.net_relay), B: fmt(B.B.net_relay), Bp: fmt(B.Bp.net_relay), C: fmt(B.C.net_relay) }, "B,Bp"],
    ["Payer total subscriptions", { A: fmt(B.A.payer_totalSubs), B: fmt(B.B.payer_totalSubs), Bp: fmt(B.Bp.payer_totalSubs), C: fmt(B.C.payer_totalSubs) }, "A,Bp,C"],
    ["Payer annual churn ops", { A: fmt(B.A.payer_churn), B: fmt(B.B.payer_churn), Bp: fmt(B.Bp.payer_churn), C: fmt(B.C.payer_churn) }, "A,Bp,C"],
    ["Ghost subscription risk", { A: "None", B: fmt(B.B.ghostSubs), Bp: fmt(B.Bp.ghostSubs), C: "None" }, "A,C"],
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
        <p>These conclusions are stable across scenarios (mature adoption, high fragmentation, cross-network mix, high payer churn). The relative ordering does not change. See the <a href="#explorer">Explorer</a> to test specific parameter combinations.</p>
      </details>
    </Section>
  );
}

// ── Methodology ──

function Methodology() {
  return (
    <Section id="methodology">
      <h2>Methodology</h2>
      <p>A TypeScript simulator generates a synthetic U.S.-scale ecosystem and counts every message, subscription, and state record for each architecture.</p>
      <div className="g2">
        <div>
          <h3>Synthetic ecosystem</h3>
          <table>
            <tbody>
              <tr><td>Population</td><td>342M (120K sampled, scaled)</td></tr>
              <tr><td>Networks</td><td>11 (Zipf-distributed sizes)</td></tr>
              <tr><td>Providers</td><td>12,000 orgs (heavy-tailed)</td></tr>
              <tr><td>Patient apps</td><td>20% enrollment, 80 vendors</td></tr>
              <tr><td>Payers</td><td>90% enrollment, 15 payers, 2.5%/mo churn</td></tr>
              <tr><td>Relationships</td><td>Mean 2.19/patient (p95: 6)</td></tr>
              <tr><td>Episodes</td><td>Mean 3.49/patient/year</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3>Key assumptions</h3>
          <table>
            <tbody>
              <tr><td>Notification copies</td><td>Outpatient: 2.1, ED: 1, Inpatient: 2</td></tr>
              <tr><td>Peer multiplexing</td><td>1 event per patient, not per client</td></tr>
              <tr><td>Deactivation failure</td><td>5% (Direct models)</td></tr>
              <tr><td>Group subs</td><td>1 per payer-source pair</td></tr>
              <tr><td>Payload</td><td>1,400 bytes/notification</td></tr>
            </tbody>
          </table>
          <h3>Not modeled</h3>
          <p style={{ fontSize: ".82rem" }}>Implementation complexity, latency, fault tolerance, cost per message, Group query overhead at sources.</p>
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

  const sl = (key: keyof typeof sliders, label: string, min: number, max: number, step: number, display: (v: number) => string) => (
    <div className="slider-group">
      <label>{label} <span>{display(sliders[key])}</span></label>
      <input type="range" min={min} max={max} step={step} value={sliders[key]} onChange={(e) => setSlider(key, parseFloat(e.target.value))} />
    </div>
  );

  return (
    <Section id="explorer">
      <h2>Interactive Explorer</h2>
      <p>Run the full simulation in your browser. Adjust parameters and compare all four architectures.</p>
      <div className="explorer-grid">
        <div className="explorer-controls card">
          {sl("appEnrollmentRate", "App enrollment", 0.02, 0.7, 0.01, (v) => `${(v * 100).toFixed(0)}%`)}
          {sl("payerEnrollmentRate", "Payer enrollment", 0.1, 0.99, 0.01, (v) => `${(v * 100).toFixed(0)}%`)}
          {sl("payerMonthlyChurn", "Payer monthly churn", 0.005, 0.15, 0.005, (v) => `${(v * 100).toFixed(1)}%`)}
          {sl("appAnnualChurn", "App annual churn", 0.02, 0.5, 0.01, (v) => `${(v * 100).toFixed(0)}%`)}
          {sl("deactivationFailure", "Deactivation failure", 0, 0.3, 0.01, (v) => `${(v * 100).toFixed(0)}%`)}
          {sl("relationshipMult", "Relationship mult", 0.5, 2.5, 0.1, (v) => `${v.toFixed(1)}x`)}
          {sl("samplePatients", "Sample patients", 5000, 120000, 5000, (v) => Math.round(v).toLocaleString())}
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
  const rows: [string, ((m: ModelId) => number) | null][] = [
    ["Total messages", (m) => data[m].totalMessages],
    ["Data plane", (m) => data[m].dataPlaneMessages],
    ["Control plane", (m) => data[m].controlPlaneMessages],
    [null, null],
    ["Direct source subs", (m) => data[m].directSourceSubs],
    ["  — Apps", (m) => data[m].directSourceSubs_apps],
    ["  — Payers", (m) => data[m].directSourceSubs_payers],
    ["  — Providers", (m) => data[m].directSourceSubs_providers],
    ["Ghost subs", (m) => data[m].ghostSubs],
    [null, null],
    ["P95 subs/source", (m) => data[m].src_p95Subs],
    ["P95 msgs/source/day", (m) => data[m].src_p95MsgsDay],
    [null, null],
    ["Payer total subs", (m) => data[m].payer_totalSubs],
    ["Payer annual churn", (m) => data[m].payer_churn],
    ["Payer ghost subs", (m) => data[m].payer_ghost],
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
          if (!fn) return <tr key={i}><td colSpan={5} style={{ border: "none", height: 4 }} /></tr>;
          return (
            <tr key={label}>
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
      <Methodology />
      <Explorer />
    </>
  );
}

// ── Mount ──
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
