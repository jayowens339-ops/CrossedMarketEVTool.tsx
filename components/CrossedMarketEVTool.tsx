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
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function harvestOddsFromParsed(obj: any): string[] {
  if (!obj || typeof obj !== "object") return [];
  const entries = Array.isArray(obj.entries) ? obj.entries : [];
  return entries.map((e: any) => (e && e.odds ? String(e.odds).trim() : null)).filter(Boolean) as string[];
}

// ─────────────────────────────────────────────
// Minimal UI helpers (typed)
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
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; subtitle?: string;
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
function Divider() { return <div className="my-4 h-px bg-neutral-800" />; }

// ─────────────────────────────────────────────
// Main Component (no-vig + JSON apply + CSV export)
// ─────────────────────────────────────────────
function CrossedMarketEVTool() {
  const [sideA, setSideA] = useState("-110");
  const [sideB, setSideB] = useState("-110");
  const [jsonText, setJsonText] = useState("");
  const [parsePreview, setParsePreview] = useState<any>(null);
  const [multi, setMulti] = useState(["-110", "+120", "3.20"]);

  const decA = toDecimal(sideA);
  const decB = toDecimal(sideB);
  const probs2 = useMemo(() => novigProbs([decA, decB]), [decA, decB]);
  const fairA = probs2[0] ? 1 / (probs2[0] as number) : null;
  const fairB = probs2[1] ? 1 / (probs2[1] as number) : null;

  const multiDec = multi.map(toDecimal).filter(Boolean) as number[];
  const multiNoVig = novigProbs(multiDec);

  return (
    <div className="flex flex-col gap-5">
      <Card title="Fair Odds Calculator">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Side A Odds" value={sideA} onChange={setSideA} placeholder="-110 or 1.91" />
          <Field label="Side B Odds" value={sideB} onChange={setSideB} placeholder="-110 or 1.91" />
        </div>
        <Divider />
        <div className="text-sm text-neutral-300">
          <p>Format: {inferFormatLabel(sideA)} / {inferFormatLabel(sideB)}</p>
          <p>Fair A: {fmtOdds(fairA).dec} ({fmtOdds(fairA).am})</p>
          <p>Fair B: {fmtOdds(fairB).dec} ({fmtOdds(fairB).am})</p>
        </div>
      </Card>

      <Card
        title="Upload or Paste (Auto-Fill)"
        right={
          <button
            onClick={() => {
              const rows = [
                ["Outcome", "Input", "Fair Dec", "Fair Am"],
                ["A", sideA, fmtOdds(fairA).dec, fmtOdds(fairA).am],
                ["B", sideB, fmtOdds(fairB).dec, fmtOdds(fairB).am],
              ];
              downloadCSV("fair_prices.csv", rows);
            }}
            className="text-xs rounded-lg border border-neutral-700 px-2 py-1 hover:border-emerald-600/50"
          >
            Export CSV
          </button>
        }
      >
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='Paste JSON from /api/parse-slip here...'
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
                  setSideB(odds[1] ?? odds[0]);
                  setMulti(odds);
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
            onClick={() => { setJsonText(""); setParsePreview(null); }}
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

      <Card title="Multi-Outcome No-Vig (Quick)">
        <textarea
          className="h-24 w-full rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm outline-none focus:border-emerald-500"
          value={multi.join(", ")}
          onChange={(e) => setMulti(e.target.value.split(/[, \n]+/).filter(Boolean))}
          placeholder="e.g. -110, +120, 3.20, 2.85"
        />
        <div className="mt-3 overflow-x-auto text-sm">
          <table className="w-full text-left">
            <thead className="text-neutral-400">
              <tr>
                <th className="py-1 pr-3">#</th>
                <th className="py-1 pr-3">Input</th>
                <th className="py-1 pr-3">Fair Prob</th>
                <th className="py-1 pr-3">Fair Odds (Dec / Am)</th>
              </tr>
            </thead>
            <tbody>
              {multi.map((m, i) => {
                const d = toDecimal(m);
                const nv = multiNoVig[i] ?? null;
                const fair = nv ? 1 / nv : null;
                const fo = fmtOdds(fair);
                return (
                  <tr key={i} className="border-t border-neutral-800/60">
                    <td className="py-1 pr-3">{i + 1}</td>
                    <td className="py-1 pr-3">{m}</td>
                    <td className="py-1 pr-3">{fmtPct(nv)}</td>
                    <td className="py-1 pr-3">{fo.dec} / {fo.am}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default CrossedMarketEVTool; // ✅ default export
