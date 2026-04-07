import { useRef, useEffect } from "react";
import { MODEL_IDS, MODEL_LABELS, MODEL_COLORS, fmt, ff } from "../../constants";
import type { ModelId } from "../../constants";
import type { ExtractedProtocol } from "../../extract";
import { useStore } from "../../store";

declare const d3: any;

interface Props {
  metrics: { label: string; key: string }[];
  data: Record<ModelId, ExtractedProtocol>;
  width?: number;
}

export function HBar({ metrics, data, width = 860 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const showTooltip = useStore((s) => s.showTooltip);
  const hideTooltip = useStore((s) => s.hideTooltip);

  useEffect(() => {
    if (!ref.current || !data) return;
    const el = ref.current;
    d3.select(el).selectAll("*").remove();

    const mg = { top: 10, right: 50, bottom: 25, left: 160 };
    const h = 40 + metrics.length * MODEL_IDS.length * 18 + metrics.length * 16;
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("width", "100%");
    const g = svg.append("g").attr("transform", `translate(${mg.left},${mg.top})`);
    const iw = width - mg.left - mg.right;
    const ih = h - mg.top - mg.bottom;

    const y0 = d3.scaleBand().domain(metrics.map((m: any) => m.label)).range([0, ih]).padding(0.3);
    const y1 = d3.scaleBand().domain(MODEL_IDS).range([0, y0.bandwidth()]).padding(0.1);
    const allV = metrics.flatMap((met: any) => MODEL_IDS.map((m) => (data[m] as any)[met.key] as number));
    const x = d3.scaleLinear().domain([0, d3.max(allV) * 1.15 || 1]).range([0, iw]).nice();

    g.append("g").attr("class", "grid").call(d3.axisBottom(x).ticks(5).tickSize(ih).tickFormat(() => ""));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y0));
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).ticks(5).tickFormat((d: number) => fmt(d)));

    metrics.forEach((met: any) => {
      MODEL_IDS.forEach((m) => {
        const v = (data[m] as any)[met.key] as number;
        if (!v) return;
        g.append("rect")
          .attr("y", y0(met.label) + y1(m))
          .attr("x", 0)
          .attr("height", y1.bandwidth())
          .attr("width", x(v))
          .attr("fill", MODEL_COLORS[m])
          .attr("rx", 2)
          .on("mouseover", (e: MouseEvent) => showTooltip(`<b>${MODEL_LABELS[m]}</b><br>${met.label}: ${ff(v)}`, e.clientX, e.clientY))
          .on("mousemove", (e: MouseEvent) => showTooltip(`<b>${MODEL_LABELS[m]}</b><br>${met.label}: ${ff(v)}`, e.clientX, e.clientY))
          .on("mouseout", hideTooltip);
        g.append("text")
          .attr("y", y0(met.label) + y1(m) + y1.bandwidth() / 2 + 4)
          .attr("x", x(v) + 4)
          .attr("font-size", "10px")
          .attr("fill", MODEL_COLORS[m])
          .attr("font-weight", "600")
          .text(`${MODEL_LABELS[m]}: ${fmt(v)}`);
      });
    });
  }, [data, metrics, width]);

  return <div ref={ref} />;
}
