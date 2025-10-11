// ---- UI bits (typed) ----
import React, { useMemo, useState, useRef } from "react";

type CardProps = {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode; // <-- optional
};
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

type PillProps = { children: React.ReactNode };
function Pill({ children }: PillProps) {
  return (
    <span className="rounded-full border border-emerald-600/40 bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-300">
      {children}
    </span>
  );
}

function Divider() {
  return <div className="my-4 h-px bg-neutral-800" />;
}
