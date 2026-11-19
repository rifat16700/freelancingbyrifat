import type { Order } from "../types";

export const money = (n: number) => "৳" + Math.round(n).toLocaleString("en-IN");
export const moneyShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 10000000) return "৳" + (n / 10000000).toFixed(2) + "Cr";
  if (a >= 100000) return "৳" + (n / 100000).toFixed(a >= 1000000 ? 1 : 2) + "L";
  if (a >= 1000) return "৳" + (n / 1000).toFixed(a >= 10000 ? 0 : 1) + "k";
  return "৳" + Math.round(n);
};
export const num = (n: number) => Math.round(n).toLocaleString("en-IN");
export const pct = (n: number, d = 1) => (isFinite(n) ? n.toFixed(d) : "0") + "%";
export const dateShort = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
export const dateFull = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
export const timeFull = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 0) return "in " + Math.round(-s / 86400) + "d";
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago";
  if (s < 86400 * 30) return Math.round(s / 86400) + "d ago";
  return Math.round(s / 86400 / 30) + "mo ago";
};
export const isValid = (o: Order) => o.status !== "Cancelled" && !o.failed;
export const dayKey = (iso: string) => iso.slice(0, 10);
export const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function downloadCSV(name: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function downloadJSON(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
