"use client";

interface BatchRun {
  id: string;
  segment_count: number;
  status: "in_progress" | "completed";
  gemini_done_count?: number;
  created_at: string;
}

interface BatchHistoryProps {
  batches: BatchRun[];
  loading: boolean;
  onSelect: (id: string, status?: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function BatchHistory({ batches, loading, onSelect }: BatchHistoryProps) {
  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
        <p className="text-xs text-zinc-500 animate-pulse">Loading batch history...</p>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
        <p className="text-xs text-zinc-500">No previous batch runs</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <span className="text-sm font-medium text-zinc-300">Batch Runs</span>
      </div>
      <div className="divide-y divide-zinc-800 max-h-64 overflow-y-auto">
        {batches.map((batch, i) => (
          <button
            key={batch.id}
            onClick={() => onSelect(batch.id, batch.status)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-300 font-medium">Batch #{batches.length - i}</span>
              <span className="text-xs text-zinc-600">{batch.segment_count} segment{batch.segment_count !== 1 ? "s" : ""}</span>
              {batch.status === "in_progress" ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-900/50 text-amber-400 border border-amber-800 animate-pulse">
                  in progress
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-900/50 text-green-400 border border-green-800">
                  completed
                </span>
              )}
              {batch.status === "in_progress" && batch.gemini_done_count != null && (
                <span className="text-[10px] text-zinc-500">
                  {batch.gemini_done_count}/{batch.segment_count} processed
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">{timeAgo(batch.created_at)}</span>
              {batch.status === "in_progress" && (
                <span className="text-xs text-amber-400 font-medium">Resume</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
