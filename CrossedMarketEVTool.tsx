"use client";
import React, { useMemo, useState, useRef } from "react";

// ─────────────────────────────────────────────
// Odds + math helpers (typed + safe)
// ─────────────────────────────────────────────
function isAmerican(str: string | null | undefined): boolean {
  return /^\s*[+-]?\d+\s*$/.test(str || "");
}

function toDecimal(oddsInput: string | number | null | undefined): number | null {
  if (oddsInput === null || oddsInput === undefined) return null;
  const raw = String(oddsInput).trim();
  if (raw === "") return null;
  if (isAmerican(raw)) {
    const a = parseInt(raw, 10);
    if (a === 0) return null;
    return a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a);
  }
  const d = Number(raw);
  if (!isFinite(d) || d <= 1) return null;
  return d;
}

function impliedProb(decimalOdds: number | null | undefined): number | null {
  return decimalOdds && decimalOdds > 1 ? 1 / decimalOdds : null;
}

function fmtPct(x: number | null | undefined, digits: number = 2): string {
  if (x === null || x === undefined || !isFinite(x)) return "–";
  return (x * 100).toFixed(digits) + "%";
}

function fmtOdds(decimal: number | null | undefined): { dec: string; am: string } {
  if (!decimal || !isFinite(decimal)) return { dec: "–", am: "–" };
  const b = decimal - 1;
  const am = decimal >= 2 ? `+${Math.round(b * 100)}` : `${Math.round(-100 / b)}`;
  return { dec: decimal.toFixed(3), am };
}

function sum(a: number[]): number {
  return a.reduce((acc, x) => acc + (isFinite(x) ? x : 0), 0);
}

function novigProbs(decimalArray: Array<number | null | undefined>): Array<number | null> {
  const probs = decimalArray.map(impliedProb);
  const s = sum(probs.map(p => (p ?? 0)));
  if (s <= 0) return probs.map(() => null);
  return probs.map(p => (p ?? 0) / s);
}

function inferFormatLabel(input: string | number | null | undefined): string {
  if (input === null || input === undefined || String(input).trim() === "") return "—";
  return isAmerican(String(input)) ? "American" : "Decimal";
}

function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]): void {
  const csv = rows
    .map(r =>
      r.map(cell => {
        const s = String(cell ?? "");
        if (s.includes(",") || s.includes('"') || s.includes("\n"))
          return '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(",")
    ).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function harvestOddsFromParsed(obj: any): string[] {
  if (!obj || typeof obj !== "object") return [];
  const entries = Array.isArray(obj.entries) ? obj.entries : [];
  return entries
    .map((e: any) => (e && e.odds ? String(e.odds).trim() : null))
    .filter(Boolean) as string[];
}

// ─────────────────────────────────────────────
// Basic UI helpers (typed)
// ─────────────────────────────────────────────
type CardProps = { title: string; children: React.ReactNode; right?: React.ReactNode };
function Card({ title, children, right }: CardProps) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 shadow-md shadow-black/30">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
        {right ?? null}
      </div>
      {children}
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  subtitle?: string;
};
function Field({ label, value, onChange, placeholder, subtitle }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-neutral-300">{label}</span>
      <input
        className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none focus:border-emerald-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {subtitle && <span className="text-xs text-neutral-500">{subtitle}</span>}
    </label>
  );
}

function Divider() {
  return <div className="my-4 h-px bg-neutral-800" />;
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
function CrossedMarketEVTool() {
  const [sideA, setSideA] = useState("");
  const [sideB, setSideB] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [parsePreview, setParsePreview] = useState<any>(null);

  const decA = toDecimal(sideA);
  const decB = toDecimal(sideB);
  const fairOdds = useMemo(() => {
    if (!decA || !decB) return null;
    const probs = novigProbs([decA, decB]);
    if (!probs[0] || !probs[1]) return null;
    return 1 / probs[0];
  }, [decA, decB]);

  return (
    <div className="flex flex-col gap-5">
      <Card title="Fair Odds Calculator">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Side A Odds" value={sideA} onChange={setSideA} placeholder="+120 or 2.20" />
          <Field label="Side B Odds" value={sideB} onChange={setSideB} placeholder="-130 or 1.77" />
        </div>
        <Divider />
        <div className="text-sm text-neutral-300">
          <p>Format: {inferFormatLabel(sideA)} / {inferFormatLabel(sideB)}</p>
          <p>Fair decimal: {fairOdds ? fairOdds.toFixed(3) : "—"}</p>
          <p>Fair implied probability: {fairOdds ? fmtPct(impliedProb(fairOdds)) : "—"}</p>
        </div>
      </Card>

      <Card
        title="Upload or Paste (Auto-Fill)"
        right={
          <button
            onClick={() => downloadCSV("fair_odds.csv", [["A", sideA], ["B", sideB]])}
            className="text-xs rounded-lg border border-neutral-700 px-2 py-1 hover:border-emerald-600/50"
          >
            Export CSV
          </button>
        }
      >
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='Paste JSON from parser here...'
          className="h-28 w-full rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-xs outline-none focus:border-emerald-500"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              try {
                const obj = JSON.parse(jsonText);
                setParsePreview(obj);
                const odds = harvestOddsFromParsed(obj);
                if (odds.length) {
                  setSideA(odds[0]);
                  setSideB(odds[1] ?? "");
                }
              } catch {
                alert("Invalid JSON");
              }
            }}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-xs hover:border-emerald-600/50"
          >
            Apply
          </button>
          <button
            onClick={() => {
              setJsonText("");
              setParsePreview(null);
            }}
            className="rounded-lg border border-neutral-800 px-3 py-2 text-xs"
          >
            Clear
          </button>
        </div>
        {parsePreview && (
          <pre className="mt-3 h-28 overflow-auto rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-xs">
            {JSON.stringify(parsePreview, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  );
}

// ✅ Default export required for Next.js page.tsx
export default CrossedMarketEVTool;
