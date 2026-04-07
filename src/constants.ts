export type ModelId = "A" | "B" | "Bp" | "C";
export const MODEL_IDS: ModelId[] = ["A", "B", "Bp", "C"];

export const MODEL_LABELS: Record<ModelId, string> = {
  A: "Broker",
  B: "Direct",
  Bp: "Direct+Group",
  C: "Encrypted",
};

export const MODEL_COLORS: Record<ModelId, string> = {
  A: "#2563eb",
  B: "#dc2626",
  Bp: "#e97a0a",
  C: "#059669",
};

export const ENTITY_COLORS = {
  apps: "#60a5fa",
  payers: "#f87171",
  providers: "#34d399",
} as const;

export function fmt(n: number): string {
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}

export function ff(n: number): string {
  return Math.round(n).toLocaleString();
}
