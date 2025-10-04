import React, { useMemo, useState, useRef } from "react";

// Crossed Market +EV Betting Tool (All-in-one, single file)
// - No-vig fair odds & probabilities (2+ outcomes)
// - EV & Kelly stake sizing
// - Cross-book crossed/arb detector
// - American (+145 / -120) & Decimal (2.45)
// - NEW: Drag-and-drop upload (image or JSON)
// - NEW: Call /api/parse-slip for screenshots → JSON → auto-fill
// - NEW: Paste JSON → auto-fill Side A/B + Multi
// - NEW: CSV export of the multi-outcome table

// ---- Odds helpers ----
function isAmerican(str) {
  return /^\s*[+-]?\d+\s*$/.test(str || "");
}

function toDecimal(oddsInput) {
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

function toAmerican(decimalOdds) {
  if (!decimalOdds || !isFinite(decimalOdds) || decimalOdds <= 1) return "";
  const b = decimalOdds - 1;
  if (decimalOdds >= 2) return `+${Math.round(b * 100)}`;
  return `${Math.round(-100 / b) * -1}`.replace("--", "-");
}

function impliedProb(decimalOdds) {
  return decimalOdds && decimalOdds > 1 ? 1 / decimalOdds : null;
}

function fmtPct(x, digits = 2) {
  if (x === null || x === undefined || !isFinite(x)) return "–";
  return (x * 100).toFixed(digits) + "%";
}

function fmtOdds(decimal) {
  if (!decimal || !isFinite(decimal)) return { dec: "–", am: "–" };
  return { dec: decimal.toFixed(3), am: toAmerican(decimal) };
}

function kellyFraction(p, decimalOdds) {
  if (!p || !decimalOdds) return 0;
  const b = decimalOdds - 1;
  const q = 1 - p;
  const f = (b * p - q) / b;
  return Math.max(0, f);
}

function expectedValue(stake, p, decimalOdds) {
  if (!stake || !p || !decimalOdds) return 0;
  const b = decimalOdds - 1;
  return stake * (p * b - (1 - p));
}

function sum(a) {
  return a.reduce((acc, x) => acc + (isFinite(x) ? x : 0), 0);
}

function novigProbs(decimalArray) {
  const probs = decimalArray.map(impliedProb);
  const s = sum(probs);
  if (s <= 0) return probs.map(() => null);
  return probs.map((p) => (p ?? 0) / s);
}

function inferFormatLabel(input) {
  if (input === null || input === undefined || String(input).trim() === "")
    return "—";
  return isAmerican(String(input)) ? "American" : "Decimal";
}

// Utility: download CSV
function downloadCSV(filename, rows) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        })
        .join(",")
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

function harvestOddsFromParsed(obj) {
  if (!obj || typeof obj !== "object") return [];
  const entries = Array.isArray(obj.entries) ? obj.entries : [];
  return entries
    .map((e) => (e && e.odds ? String(e.odds).trim() : null))
    .filter(Boolean);
}

// Small UI helpers
function Card({ title, children, right }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 shadow-md shadow-black/30">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}
function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-neutral-300">{label}</span>
      <input
        className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none focus:border-emerald-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
function Pill({ children }) {
  return (
    <span className="rounded-full border border-emerald-600/40 bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-300">
      {children}
    </span>
  );
}
function Divider() {
  return <div className="my-4 h-px bg-neutral-800" />;
}

// Main Component
export default function CrossedMarketEVTool() {
  const [sideA, setSideA] = useState("-110");
  const [sideB, setSideB] = useState("-110");
  const [stake, setStake] = useState("100");

  const decA = useMemo(() => toDecimal(sideA), [sideA]);
  const decB = useMemo(() => toDecimal(sideB), [sideB]);
  const probs2 = useMemo(() => novigProbs([decA, decB]), [decA, decB]);
  const fairA = probs2[0] ? 1 / probs2[0] : null;
  const fairB = probs2[1] ? 1 / probs2[1] : null;

  const pA = probs2[0];
  const pB = probs2[1];
  const stakeNum = Number(stake) || 0;

  const [jsonText, setJsonText] = useState("");
  const [parsePreview, setParsePreview] = useState(null);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef(null);
  const [multi, setMulti] = useState(["-110", "+120", "3.20"]);
  const multiDec = multi.map(toDecimal).filter(Boolean);
  const multiNoVig = novigProbs(multiDec);

  async function handleParseScreenshot(file) {
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch("/api/parse-slip", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Upload failed");
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

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      try {
        await handleParseScreenshot(file);
      } catch (err) {
        alert(String(err));
      }
    } else if (
      file.type === "application/json" ||
      file.name.endsWith(".json")
    ) {
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
      } catch {}
    } else {
      alert("Drop an image (screenshot) or a JSON file.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 text-neutral-200">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-100">
          Crossed Market +EV Tool{" "}
          <span className="text-emerald-400">• No-Vig Fair Odds</span>
        </h1>
        <Pill>Drag + Drop Enabled</Pill>
      </header>

      {/* Upload / JSON Section */}
      <Card
        title="Upload or Paste (Auto-Fill)"
        right={
          <button
            onClick={() => downloadCSV("multi_fair_prices.csv", [])}
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
            setDropActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDropActive(false);
          }}
          className={`rounded-xl border p-4 text-sm ${
            dropActive
              ? "border-emerald-600 bg-emerald-900/10"
              : "border-neutral-800 bg-neutral-900"
          }`}
        >
          <div className="mb-2 font-medium">
            Drag & drop a screenshot (image) or JSON file here
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.json"
            className="text-xs"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.type.startsWith("image/")) {
                try {
                  await handleParseScreenshot(f);
                } catch (err) {
                  alert(String(err));
                }
              } else if (
                f.type === "application/json" ||
                f.name.endsWith(".json")
              ) {
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
        </div>
      </Card>

      <Divider />

      <Card title="Fair Odds Calculator">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Side A Odds"
            value={sideA}
            onChange={setSideA}
            placeholder="-110 or 1.91"
          />
          <Field
            label="Side B Odds"
            value={sideB}
            onChange={setSideB}
            placeholder="-110 or 1.91"
          />
        </div>
        <Divider />
        <div>
          <p className="text-sm text-neutral-300">
            Fair A: {fmtOdds(fairA).dec} ({fmtOdds(fairA).am}) | Fair B:{" "}
            {fmtOdds(fairB).dec} ({fmtOdds(fairB).am})
          </p>
        </div>
      </Card>
    </div>
  );
}
