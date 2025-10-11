"use client";
import React from "react";
import CrossedMarketEVTool from "../components/CrossedMarketEVTool"; // ← changed

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-4">Crossed Market +EV Tool</h1>
      <CrossedMarketEVTool />
    </main>
  );
}
