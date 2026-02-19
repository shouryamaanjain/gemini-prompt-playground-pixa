"use client";

interface BatchBarProps {
  selectedCount: number;
  onStart: () => void;
  onClear: () => void;
}

export default function BatchBar({ selectedCount, onStart, onClear }: BatchBarProps) {
  return (
    <div className="flex items-center justify-between bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <span className="text-sm text-zinc-300">
        <span className="font-medium text-zinc-100">{selectedCount}</span> segment{selectedCount !== 1 ? "s" : ""} selected
      </span>

      <div className="flex gap-2">
        {selectedCount > 0 && (
          <button
            onClick={onClear}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300 transition"
          >
            Clear
          </button>
        )}
        <button
          onClick={onStart}
          disabled={selectedCount === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium transition bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Start Batch
        </button>
      </div>
    </div>
  );
}
