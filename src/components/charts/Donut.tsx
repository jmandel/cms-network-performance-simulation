import { useRef, useEffect } from "react";
import { fmt, ff } from "../../constants";
import { useStore } from "../../store";

declare const d3: any;

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  total: number;
  centerLabel: string;
}

export function Donut({ segments, total, centerLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const showTooltip = useStore((s) => s.showTooltip);
  const hideTooltip = useStore((s) => s.hideTooltip);

  useEffect(() => {
    if (!ref.current) return;
    d3.select(ref.current).selectAll("*").remove();

    const sz = 180, r = sz / 2 - 8;
    const svg = d3.select(ref.current).append("svg")
      .attr("viewBox", `0 0 ${sz + 150} ${sz}`)
      .attr("width", "100%");
    const g = svg.append("g").attr("transform", `translate(${sz / 2},${sz / 2})`);

    const pie = d3.pie().value((d: Segment) => d.value).sort(null);
    const arc = d3.arc().innerRadius(r * 0.55).outerRadius(r);

    g.selectAll("path").data(pie(segments)).join("path")
      .attr("d", arc)
      .attr("fill", (d: any) => d.data.color)
      .attr("stroke", "#fff").attr("stroke-width", 2)
      .on("mouseover", (e: MouseEvent, d: any) =>
        showTooltip(`<b>${d.data.label}</b><br>${ff(d.data.value)} (${(d.data.value / total * 100).toFixed(0)}%)`, e.clientX, e.clientY))
      .on("mousemove", (e: MouseEvent, d: any) =>
        showTooltip(`<b>${d.data.label}</b><br>${ff(d.data.value)} (${(d.data.value / total * 100).toFixed(0)}%)`, e.clientX, e.clientY))
      .on("mouseout", hideTooltip);

    g.append("text").attr("text-anchor", "middle").attr("dy", "-.2em")
      .attr("font-size", "1.2em").attr("font-weight", "700").text(fmt(total));
    g.append("text").attr("text-anchor", "middle").attr("dy", "1em")
      .attr("font-size", ".65em").attr("fill", "#6b7280").text(centerLabel);

    const lg = svg.append("g").attr("transform", `translate(${sz + 6},${sz / 2 - segments.length * 12})`);
    segments.forEach((d, i) => {
      const row = lg.append("g").attr("transform", `translate(0,${i * 24})`);
      row.append("rect").attr("width", 12).attr("height", 12).attr("rx", 2).attr("fill", d.color);
      row.append("text").attr("x", 16).attr("y", 11).attr("font-size", ".78em")
        .text(`${d.label}: ${fmt(d.value)}`);
    });
  }, [segments, total, centerLabel]);

  return <div ref={ref} />;
}
