"use client";

import { Segment } from "@/lib/types";
import type { SchemaField } from "@/lib/gemini-defaults";

export interface BatchSegmentState {
  userAnswers: Record<string, unknown>;
  geminiResult: Record<string, unknown> | null;
  geminiLoading: boolean;
  geminiError: string | null;
  transcriptCorrect: boolean | null;
}

interface BatchSegmentNavProps {
  segments: Segment[];
  currentIndex: number;
  onSelect: (index: number) => void;
  stateMap: Map<string, BatchSegmentState>;
  onBack: () => void;
  onRetry?: (segment: Segment) => void;
  fields: SchemaField[];
  readOnly?: boolean;
}

function segKey(s: Segment) {
  return `${s.video_id}/${s.segment_id}`;
}

export function isSegmentComplete(
  state: BatchSegmentState | undefined,
  fields: SchemaField[]
): boolean {
  if (!state) return false;
  const geminiFinished = state.geminiResult != null || state.geminiError != null;
  if (!geminiFinished) return false;
  if (fields.length > 0 && !fields.every((f) => state.userAnswers[f.key] !== undefined)) return false;
  const hasTranscript = typeof state.geminiResult?.transcript === "string";
  if (hasTranscript && state.transcriptCorrect == null) return false;
  return true;
}

function getStatus(state: BatchSegmentState | undefined, fields: SchemaField[]): {
  label: string;
  className: string;
} {
  if (!state) return { label: "pending", className: "bg-zinc-700 text-zinc-400" };
  if (isSegmentComplete(state, fields)) return { label: "complete", className: "bg-green-900/50 text-green-400 border border-green-800" };
  if (state.geminiError) return { label: "error", className: "bg-red-900/50 text-red-400 border border-red-800" };
  if (state.geminiLoading) return { label: "processing", className: "bg-amber-900/50 text-amber-400 border border-amber-800 animate-pulse" };
  if (state.geminiResult) {
    const hasAnswers = Object.keys(state.userAnswers).length > 0;
    if (hasAnswers) return { label: "in progress", className: "bg-blue-900/50 text-blue-400 border border-blue-800" };
    return { label: "ready", className: "bg-zinc-600 text-zinc-300" };
  }
  return { label: "pending", className: "bg-zinc-700 text-zinc-400" };
}

export default function BatchSegmentNav({ segments, currentIndex, onSelect, stateMap, onBack, onRetry, fields, readOnly }: BatchSegmentNavProps) {
  const current = segments[currentIndex];
  const currentState = current ? stateMap.get(segKey(current)) : undefined;

  const completeCount = Array.from(stateMap.values()).filter((s) => isSegmentComplete(s, fields)).length;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onBack}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          &larr; {readOnly ? "Back to dashboard" : "Back to selection"}
        </button>
        <div className="text-center">
          <p className="text-sm text-zinc-400">
            {current?.video_id} / {current?.segment_id}
          </p>
          <p className="text-xs text-zinc-600">
            {currentIndex + 1} of {segments.length} in batch &middot; {completeCount} complete
          </p>
        </div>
        <div className="w-28" />
      </div>

      {/* Segment pills */}
      <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
        {segments.map((seg, i) => {
          const state = stateMap.get(segKey(seg));
          const status = getStatus(state, fields);
          const isActive = i === currentIndex;

          return (
            <button
              key={segKey(seg)}
              onClick={() => onSelect(i)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition ${
                isActive
                  ? "ring-2 ring-white ring-offset-1 ring-offset-zinc-900"
                  : ""
              } ${status.className}`}
              title={`${seg.segment_id} — ${status.label}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Prev/Next + Retry */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800">
        <button
          onClick={() => onSelect(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
        >
          Previous
        </button>

        {!readOnly && onRetry && currentState?.geminiError && (
          <button
            onClick={() => onRetry(current)}
            className="px-4 py-2 rounded-lg bg-amber-900/50 text-amber-400 border border-amber-800 hover:bg-amber-900/80 text-sm font-medium transition"
          >
            Retry Gemini
          </button>
        )}

        <button
          onClick={() => onSelect(Math.min(segments.length - 1, currentIndex + 1))}
          disabled={currentIndex === segments.length - 1}
          className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
        >
          Next
        </button>
      </div>
    </div>
  );
}
