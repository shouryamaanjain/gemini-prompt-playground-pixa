"use client";

import { Segment } from "@/lib/types";

interface SegmentNavProps {
  segments: Segment[];
  currentIndex: number;
  onSelect: (index: number) => void;
  completedSet?: Set<string>;
  selectedSet?: Set<string>;
  onToggleSelect?: (key: string) => void;
  onSelectAll?: () => void;
}

function segKey(s: Segment) {
  return `${s.video_id}/${s.segment_id}`;
}

export default function SegmentNav({
  segments, currentIndex, onSelect, completedSet, selectedSet, onToggleSelect, onSelectAll,
}: SegmentNavProps) {
  const current = segments[currentIndex];
  const key = current ? segKey(current) : "";
  const isSelected = selectedSet?.has(key) ?? false;

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onSelect(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
        >
          Previous
        </button>

        <div className="text-center flex items-center gap-3">
          <div>
            <p className="text-sm text-zinc-400">
              {current?.video_id} / {current?.segment_id}
            </p>
            <p className="text-xs text-zinc-600">
              {currentIndex + 1} of {segments.length}
              {completedSet && completedSet.size > 0 && ` (${completedSet.size} annotated)`}
            </p>
          </div>

          {onToggleSelect && current && (
            <button
              onClick={() => onToggleSelect(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                isSelected
                  ? "bg-white text-black"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {isSelected ? "Selected" : "Select"}
            </button>
          )}
        </div>

        <button
          onClick={() => onSelect(Math.min(segments.length - 1, currentIndex + 1))}
          disabled={currentIndex === segments.length - 1}
          className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
        >
          Next
        </button>
      </div>

      {/* Quick jump + Select All */}
      {onToggleSelect && (
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
          <label className="text-xs text-zinc-500">Jump to:</label>
          <input
            type="number"
            min={1}
            max={segments.length}
            value={currentIndex + 1}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (v >= 1 && v <= segments.length) onSelect(v - 1);
            }}
            className="w-16 bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs rounded px-2 py-1 text-center focus:outline-none focus:border-zinc-500"
          />
          <span className="text-xs text-zinc-600">/ {segments.length}</span>
          <div className="flex-1" />
          {onSelectAll && (
            <button
              onClick={onSelectAll}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              Select All
            </button>
          )}
        </div>
      )}
    </div>
  );
}
