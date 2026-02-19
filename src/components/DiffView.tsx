"use client";

import type { SchemaField } from "@/lib/gemini-defaults";

interface DiffViewProps {
  fields: SchemaField[];
  userAnswers: Record<string, unknown>;
  geminiAnswers: Record<string, unknown>;
}

export default function DiffView({ fields, userAnswers, geminiAnswers }: DiffViewProps) {
  const diffs = fields.filter(
    (f) => userAnswers[f.key] !== undefined && geminiAnswers[f.key] !== undefined
  ).map((f) => ({
    key: f.key,
    label: f.label + (f.type === "boolean" ? "?" : ""),
    user: userAnswers[f.key],
    gemini: geminiAnswers[f.key],
    match: String(userAnswers[f.key]) === String(geminiAnswers[f.key]),
  }));

  const matches = diffs.filter((d) => d.match).length;
  const total = diffs.length;

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
        <span className="text-sm font-medium text-zinc-300">Comparison</span>
        <span className="text-sm text-zinc-500">
          {matches}/{total} match
        </span>
      </div>

      <div className="divide-y divide-zinc-800">
        {diffs.map((d) => (
          <div
            key={d.key}
            className={`px-4 py-3 flex items-center justify-between ${
              d.match ? "bg-zinc-950" : ""
            }`}
          >
            <span className="text-sm text-zinc-400 min-w-[160px]">{d.label}</span>

            {d.match ? (
              <span className="text-sm text-zinc-500">{formatValue(d.user)}</span>
            ) : (
              <div className="flex gap-3">
                <span className="text-sm px-2 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-800">
                  You: {formatValue(d.user)}
                </span>
                <span className="text-sm px-2 py-0.5 rounded bg-red-900/50 text-red-400 border border-red-800">
                  Gemini: {formatValue(d.gemini)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v.replace(/_/g, " ");
  return String(v);
}
