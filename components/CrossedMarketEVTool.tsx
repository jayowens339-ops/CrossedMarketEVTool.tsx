"use client";
import React, { useMemo, useRef, useState } from "react";

/* ─────────────────────────────────────────────
   Odds helpers (typed + safe)
────────────────────────────────────────────── */
function isAmerican(str: string | null | undefined): boolean {
  return /^\s*[+-]?\d+\s*$/.test(str || "");
}
function toDecimal(oddsInput: string | number | null | undefined): number | null {
  if (oddsInput === null || oddsInput === undefined) return null;
  const raw = String(oddsInput).trim();
  if (!raw) return null;
  if (isAmerican(raw)) {
    const a = parseInt(raw, 10);
    if (!a) return null;
    return a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a);
  }
  const d = Number(raw);
  if (!Number.isFinite(d) || d <= 1) return null;
  return d;
}
function toAmerican(decimalOdds: number | null | undefined): string {
  if (!decimalOdds || !Number.isFinite(decimalOdds) || decimalOdds <= 1) return "";
  const b = decimalOdds - 1;
  return decimalOdds >= 2 ? `+${Math.round(b * 100)}` : `${Math.round(-100 / b)}`;
}
function impliedProb(decimalOdds: number | null | undefined): number | null {
  return decimalOdds && decimalOdds > 1 ? 1 / decimalOdds : null;
}
function fmtPct(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  return (x * 100).toFixed(digits) + "%";
}
function fmtOdds(decimal: number | null | undefined): { dec: string; am: string } {
  if (!decimal || !Number.isFinite(decimal)) return { dec: "–", am: "–" };
  return { dec: decimal.toFixed(3), am: toAmerican(decimal) };
}
function sum(xs: number[]): number {
  return xs.reduce((a, x) => a + (Number.isFinite(x) ? x : 0), 0);
}
function novigProbs(decimals: Array<number | null | undefined>): Array<number | null> {
  const probs = decimals.map(impliedProb);
  const s = sum(probs.map((p) => p ?? 0));
  if (s <= 0) return probs.map(() => null);
  return probs.map((p) => ((p ?? 0) / s));
}
function kellyFraction(p: number | null | undefined, dec: number | null | undefined): number {
  if (!p || !dec) return 0;
  const b = dec - 1;
  const q = 1 - p;
  const f = (b * p - q) / b;
  return Math.max(0, f);
}
function expectedValue(stake: number, p: number | null | undefined, dec: number | null | undefined): number {
  if (!stake || !p || !dec) return 0;
  const b = dec - 1;
  return stake * (p * b - (1 - p));
}
function inferFormatLabel(input: string | number | null | undefined): string {
  if (input === null || input === undefined || String(input).trim() === "") return "—";
  return isAmerican(String(input)) ? "American" : "Decimal";
}

/* ─────────────────────────────────────────────
   CSV
────────────────────────────────────────────── */
function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]): void {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────
   Parser helpers
────────────────────────────────────────────── */
type ParsedEntry = {
  player?: string;
  market?: string;
  line?: number;
  selection?: string;
  odds?: string;
  book?: string;
  rawText?: string;
};
type ParsedSlip = { source?: string; entries?: ParsedEntry[]; extractedAt?: string };

function harvestOddsFromParsed(obj: ParsedSlip | any): string[] {
  if (!obj || typeof obj !== "object") return [];
  const entries: ParsedEntry[] = Array.isArray(obj.entries) ? obj.entries : [];
  return entries.map((e) => (e && e.odds ? String(e.odds).trim() : null)).filter(Boolean) as string[];
}

/* ─────────────────────────────────────────────
   Small UI helpers (typed)
────────────────────────────────────────────── */
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
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-emerald-600/40 bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-300">
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────
   Main Component
────────────────────────────────────────────── */
function CrossedMarketEVTool() {
  /* Two-outcome */
  const [sideA, setSideA] = useState("-110");
  const [sideB, setSideB] = useState("-110");
  const [stake, setStake] = useState("100");

  const decA = useMemo(() => toDecimal(sideA), [sideA]);
  const decB = useMemo(() => toDecimal(sideB), [sideB]);
  const probs2 = useMemo(() => novigProbs([decA, decB]), [decA, decB]);
  const pA = probs2[0];
  const pB = probs2[1];
  const fairA = pA ? 1 / pA : null;
  const fairB = pB ? 1 / pB : null;
  const overround2 = useMemo(() => {
    const s = (impliedProb(decA) ?? 0) + (impliedProb(decB) ?? 0);
    return s > 0 ? s - 1 : null;
  }, [decA, decB]);

  const stakeNum = Number(stake) || 0;
  const kA = kellyFraction(pA, decA);
  const kB = kellyFraction(pB, decB);

  /* Cross-book scanner */
  type BookRow = { id: string; book: string; odds: string };
  const [booksA, setBooksA] = useState<BookRow[]>([
    { id: "a1", book: "Book A", odds: "+105" },
    { id: "a2", book: "Book B", odds: "-102" },
  ]);
  const [booksB, setBooksB] = useState<BookRow[]>([
    { id: "b1", book: "Book C", odds: "-105" },
    { id: "b2", book: "Book D", odds: "+100" },
  ]);

  const bestA = useMemo(() => {
    const rows = booksA
      .map((r) => ({ ...r, dec: toDecimal(r.odds), imp: impliedProb(toDecimal(r.odds)) }))
      .filter((r) => r.dec && r.dec > 1 && r.imp);
    if (!rows.length) return null as any;
    return rows.reduce((best, r) => (r.dec! > best.dec! ? r : best), rows[0]);
  }, [booksA]);

  const bestB = useMemo(() => {
    const rows = booksB
      .map((r) => ({ ...r, dec: toDecimal(r.odds), imp: impliedProb(toDecimal(r.odds)) }))
      .filter((r) => r.dec && r.dec > 1 && r.imp);
    if (!rows.length) return null as any;
    return rows.reduce((best, r) => (r.dec! > best.dec! ? r : best), rows[0]);
  }, [booksB]);

  const arb = useMemo(() => {
    if (!bestA || !bestB) return null as any;
    const s = (bestA.imp ?? 0) + (bestB.imp ?? 0);
    return { s, overround: s - 1 };
  }, [bestA, bestB]);

  const addRow = (which: "A" | "B") => {
    const id = `${which}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fn = which === "A" ? setBooksA : setBooksB;
    fn((prev) => [...prev, { id, book: "", odds: "" }]);
  };
  const updateRow = (which: "A" | "B", id: string, field: "book" | "odds", value: string) => {
    const fn = which === "A" ? setBooksA : setBooksB;
    fn((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };
  const removeRow = (which: "A" | "B", id: string) => {
    const fn = which === "A" ? setBooksA : setBooksB;
    fn((prev) => prev.filter((r) => r.id !== id));
  };

  /* Multi-outcome */
  const [multi, setMulti] = useState<string[]>(["-110", "+120", "3.20"]);
  const multiDec = multi.map(toDecimal).filter(Boolean) as number[];
  const multiNoVig = novigProbs(multiDec);

  /* Drag/drop + JSON */
  const [jsonText, setJsonText] = useState("");
  const [parsePreview, setParsePreview] = useState<ParsedSlip | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleParseScreenshot(file: File) {
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch("/api/parse-slip", { method: "POST", body: fd });
    const data = (await res.json()) as ParsedSlip | any;
    if (!res.ok) throw new Error((data && data.error) || "Upload failed");
    setParsePreview(data);
    const odds = harvestOddsFromParsed(data);
    if (odds.length) {
      setSideA(odds[0] ?? sideA);
      setSideB(odds[1] ?? odds[0] ?? sideB);
      setMulti(odds);
    }
  }
  function handleApplyJSON() {
    try {
      const obj = JSON.parse(jsonText);
      setParsePreview(obj);
      const odds = harvestOddsFromParsed(obj);
      if (odds.length) {
        setSideA(odds[0] ?? sideA);
        setSideB(odds[1] ?? odds[0] ?? sideB);
        setMulti(odds);
      }
    } catch {
      alert("Invalid JSON");
    }
  }
  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      try {
        await handleParseScreenshot(file);
      } catch (err: any) {
        alert(String(err?.message || err));
      }
    } else if (file.type === "application/json" || file.name.endsWith(".json")) {
      const text = await file.text();
      setJsonText(text);
      try {
        const obj = JSON.parse(text);
        setParsePreview(obj);
        const odds = harvestOddsFromParsed(obj);
        if (odds.length) {
          setSideA(odds[0]);
          setSideB(odds[1] ?? odds[0]);
          setMulti(odds);
        }
      } catch {
        alert("Invalid JSON file");
      }
    } else {
      alert("Drop an image or a JSON file.");
    }
  }
  function exportMultiCSV() {
    const header = ["Outcome #", "Input", "Decimal", "Implied", "No-Vig Prob", "Fair Dec", "Fair Am"];
    const rows: (string | number | null | undefined)[][] = [header];
    multi.forEach((m, i) => {
      const d = toDecimal(m);
      const imp = impliedProb(d);
      const nv = multiNoVig[i] ?? null;
      const fair = nv ? 1 / nv : null;
      const fo = fmtOdds(fair);
      rows.push([
        `#${i + 1}`,
        m,
        d ? d.toFixed(3) : "",
        imp ? (imp * 100).toFixed(2) + "%" : "",
        nv ? (nv * 100).toFixed(2) + "%" : "",
        fo.dec,
        fo.am,
      ]);
    });
    downloadCSV("multi_fair_prices.csv", rows);
  }

  return (
    <div className="mx-auto max-w-5xl p-6 text-neutral-200">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
          Crossed Market +EV Tool <span className="text-emerald-400">• No-Vig Fair Odds</span>
        </h1>
        <div className="flex items-center gap-2 text-xs">
          <Pill>American & Decimal</Pill>
          <Pill>No-Vig • EV • Kelly</Pill>
          <Pill>Arb / Crossed</Pill>
        </div>
      </header>

      {/* Upload / Paste */}
      <Card
        title="Upload or Paste (Auto-Fill)"
        right={
          <button
            onClick={exportMultiCSV}
            className="text-xs rounded-lg border border-neutral-700 px-2 py-1 hover:border-emerald-600/50"
          >
            Export CSV
          </button>
        }
      >
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDropActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDropActive(false);
          }}
          className={`rounded-xl border p-4 text-sm ${
            dropActive ? "border-emerald-600 bg-emerald-900/10" : "border-neutral-800 bg-neutral-900"
          }`}
        >
          <div className="mb-2 font-medium">Drag & drop a screenshot (image) or JSON file here</div>
          <div className="text-neutral-400">
            Images call <code>/api/parse-slip</code> → structured JSON → auto-fill odds.
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.json"
              className="text-xs"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.type.startsWith("image/")) {
                  try {
                    await handleParseScreenshot(f);
                  } catch (err: any) {
                    alert(String(err?.message || err));
                  }
                } else if (f.type === "application/json" || f.name.endsWith(".json")) {
                  const text = await f.text();
                  setJsonText(text);
                  try {
                    const obj = JSON.parse(text);
                    setParsePreview(obj);
                    const odds = harvestOddsFromParsed(obj);
                    if (odds.length) {
                      setSideA(odds[0]);
                      setSideB(odds[1] ?? odds[0]);
                      setMulti(odds);
                    }
                  } catch {
                    alert("Invalid JSON file");
                  }
                }
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-neutral-700 px-3 py-1 text-xs hover:border-emerald-600/50"
            >
              Choose file…
            </button>
          </div>
        </div>

        <Divider />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-sm text-neutral-300">Paste JSON (from parser or your own)</div>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='{"source":"prizepicks","entries":[{"player":"...","market":"Points","line":27.5,"selection":"over","odds":"-115","book":"PrizePicks"}]}'
              className="h-28 w-full rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-xs outline-none focus:border-emerald-500"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleApplyJSON}
                className="rounded-lg border border-neutral-700 px-3 py-2 text-xs hover:border-emerald-600/50"
              >
                Apply to calculator
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
          </div>
          <div>
            <div className="mb-1 text-sm text-neutral-300">Preview (what we parsed)</div>
            <pre className="h-28 overflow-auto rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-xs">
              {parsePreview ? JSON.stringify(parsePreview, null, 2) : "(Nothing yet)"}
            </pre>
          </div>
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Two-outcome fair odds */}
        <Card
          title="No-Vig Fair Odds (Two-Outcome)"
          right={<span className="text-xs text-neutral-400">Format: {inferFormatLabel(sideA)} / {inferFormatLabel(sideB)}</span>}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Side A Odds" value={sideA} onChange={setSideA} placeholder="-110 or 1.91" subtitle="e.g., -110, +105, 2.05" />
            <Field label="Side B Odds" value={sideB} onChange={setSideB} placeholder="-110 or 1.91" />
          </div>

          <Divider />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-neutral-400">Implied (with vig)</div>
              <div className="mt-1 text-lg">A {fmtPct(impliedProb(decA))} • B {fmtPct(impliedProb(decB))}</div>
              <div className="text-xs text-neutral-500">Book hold/overround: {overround2 !== null ? fmtPct(overround2) : "–"}</div>
            </div>
            <div>
              <div className="text-neutral-400">No-Vig Fair</div>
              <div className="mt-1 text-lg">A {fmtPct(pA)} • B {fmtPct(pB)}</div>
              <div className="text-xs text-neutral-500">
                Fair A: {fmtOdds(fairA).dec} ({fmtOdds(fairA).am}) • Fair B: {fmtOdds(fairB).dec} ({fmtOdds(fairB).am})
              </div>
            </div>
          </div>

          <Divider />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
            <Field label="Stake (unit)" value={stake} onChange={setStake} placeholder="100" />
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
              <div className="text-neutral-400">A: EV & Kelly</div>
              <div className="mt-1">EV: ${expectedValue(stakeNum, pA, decA).toFixed(2)}</div>
              <div>Kelly: {(kellyFraction(pA, decA) * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
              <div className="text-neutral-400">B: EV & Kelly</div>
              <div className="mt-1">EV: ${expectedValue(stakeNum, pB, decB).toFixed(2)}</div>
              <div>Kelly: {(kellyFraction(pB, decB) * 100).toFixed(1)}%</div>
            </div>
          </div>
        </Card>

        {/* Cross-book scanner */}
        <Card title="Cross-Book Scanner (Find Crossed / Arb)">
          <div className="mb-2 text-sm text-neutral-400">
            Enter offers for the same market from different books. We pick the best price each side and check if implied(A_best)+implied(B_best) &lt; 100%.
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 text-sm">
            <div>
              <div className="mb-1 font-medium text-neutral-200">Side A</div>
              <div className="space-y-2">
                {booksA.map((r) => (
                  <div key={r.id} className="grid grid-cols-[1fr,120px,28px] items-center gap-2">
                    <input className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2" placeholder="Book name" value={r.book} onChange={(e) => updateRow("A", r.id, "book", e.target.value)} />
                    <input className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2" placeholder="-110 or 2.05" value={r.odds} onChange={(e) => updateRow("A", r.id, "odds", e.target.value)} />
                    <button className="rounded-lg border border-neutral-800 bg-neutral-950 p-1 text-neutral-400 hover:text-red-300" onClick={() => removeRow("A", r.id)}>×</button>
                  </div>
                ))}
                <button onClick={() => addRow("A")} className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 hover:border-emerald-600/40">+ Add A offer</button>
              </div>
            </div>
            <div>
              <div className="mb-1 font-medium text-neutral-200">Side B</div>
              <div className="space-y-2">
                {booksB.map((r) => (
                  <div key={r.id} className="grid grid-cols-[1fr,120px,28px] items-center gap-2">
                    <input className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2" placeholder="Book name" value={r.book} onChange={(e) => updateRow("B", r.id, "book", e.target.value)} />
                    <input className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2" placeholder="-110 or 2.05" value={r.odds} onChange={(e) => updateRow("B", r.id, "odds", e.target.value)} />
                    <button className="rounded-lg border border-neutral-800 bg-neutral-950 p-1 text-neutral-400 hover:text-red-300" onClick={() => removeRow("B", r.id)}>×</button>
                  </div>
                ))}
                <button onClick={() => addRow("B")} className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 hover:border-emerald-600/40">+ Add B offer</button>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm">
            {arb ? (
              <>
                <div className="text-neutral-300">Implied sum (best A + best B): <span className="font-semibold">{fmtPct(arb.s)}</span></div>
                {arb.s < 1 ? (
                  <div className="mt-2 rounded-lg border border-emerald-700/40 bg-emerald-900/20 p-3 text-emerald-300">
                    <div className="font-semibold">Crossed / Arbitrage detected ✅</div>
                    <div>Edge: {fmtPct(1 - arb.s)}</div>
                  </div>
                ) : (
                  <div className="mt-2 rounded-lg border border-amber-700/40 bg-amber-900/20 p-3 text-amber-200">
                    <div className="font-semibold">No arb</div>
                    <div>Compare each side vs fair line for +EV.</div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-neutral-400">Enter odds for each side to evaluate.</div>
            )}
          </div>
        </Card>

        {/* Multi-outcome */}
        <Card title="Multi-Outcome No-Vig (Moneyline / 3-way / Futures)">
          <div className="text-sm text-neutral-400">Paste odds for all outcomes (comma/space separated), drop a JSON, or parse a screenshot. We normalize to 100% and output fair prices.</div>
          <div className="mt-3">
            <textarea
              className="h-24 w-full rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm outline-none focus:border-emerald-500"
              value={multi.join(", ")}
              onChange={(e) => setMulti(e.target.value.split(/[,\s]+/).filter(Boolean))}
              placeholder="e.g. -110, +120, 3.20, 2.85"
            />
          </div>
          <div className="mt-3 overflow-x-auto text-sm">
            <table className="w-full text-left">
              <thead className="text-neutral-400">
                <tr>
                  <th className="py-1 pr-3">Outcome</th>
                  <th className="py-1 pr-3">Input</th>
                  <th className="py-1 pr-3">Decimal</th>
                  <th className="py-1 pr-3">Implied</th>
                  <th className="py-1 pr-3">No-Vig Prob</th>
                  <th className="py-1 pr-3">Fair Odds (Dec / Am)</th>
                </tr>
              </thead>
              <tbody>
                {multi.map((m, i) => {
                  const d = toDecimal(m);
                  const imp = impliedProb(d);
                  const nv = multiNoVig[i] ?? null;
                  const fair = nv ? 1 / nv : null;
                  const fo = fmtOdds(fair);
                  return (
                    <tr key={i} className="border-t border-neutral-800/60">
                      <td className="py-1 pr-3">#{i + 1}</td>
                      <td className="py-1 pr-3">{m}</td>
                      <td className="py-1 pr-3">{d ? d.toFixed(3) : "–"}</td>
                      <td className="py-1 pr-3">{fmtPct(imp)}</td>
                      <td className="py-1 pr-3">{fmtPct(nv)}</td>
                      <td className="py-1 pr-3">{fo.dec} / {fo.am}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="How to Use (Quick Guide)">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-300">
            <li><span className="font-medium">Drag & Drop:</span> Drop a screenshot → we call <code>/api/parse-slip</code> → we auto-fill odds.</li>
            <li><span className="font-medium">Paste JSON:</span> Paste parser JSON and click <em>Apply</em> to fill Side A/B and Multi.</li>
            <li><span className="font-medium">No-Vig (Two-Outcome):</span> Enter prices. We normalize implied probs to 100% to get fair odds.</li>
            <li><span className="font-medium">Cross-Book Scanner:</span> If implied(A_best)+implied(B_best) &lt; 100% → crossed/arb.</li>
            <li><span className="font-medium">CSV Export:</span> Click <em>Export CSV</em> to download the multi-outcome fair pricing table.</li>
          </ol>
          <div className="mt-3 text-xs text-neutral-500">Educational use only. Not betting advice.</div>
        </Card>
      </div>

      <footer className="mt-6 text-center text-xs text-neutral-500">Built for +EV hunters • Learn • Earn • Own</footer>
    </div>
  );
}

export default CrossedMarketEVTool;
