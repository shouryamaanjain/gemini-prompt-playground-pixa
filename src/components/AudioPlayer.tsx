"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface AudioPlayerProps {
  src: string;
  transcript?: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function AudioPlayer({ src, transcript }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const toggle = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEEDS.indexOf(prev);
      const next = SPEEDS[(idx + 1) % SPEEDS.length];
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);

  const skip = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
  }, [duration]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.code === "ArrowLeft" && e.shiftKey) {
        e.preventDefault();
        skip(-5);
      } else if (e.code === "ArrowRight" && e.shiftKey) {
        e.preventDefault();
        skip(5);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, skip]);

  const seekTo = useCallback(
    (clientX: number) => {
      if (!audioRef.current || !barRef.current || !duration) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newTime = pct * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration]
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => seekTo(e.clientX);
    const onUp = () => setDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, seekTo]);

  const pct = duration ? (currentTime / duration) * 100 : 0;

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => {
          if (!dragging) setCurrentTime(audioRef.current?.currentTime || 0);
        }}
        onLoadedMetadata={() => {
          setDuration(audioRef.current?.duration || 0);
          if (audioRef.current) audioRef.current.playbackRate = speed;
        }}
        onEnded={() => setPlaying(false)}
      />

      <div className="flex items-center gap-3">
        {/* Skip back */}
        <button
          onClick={() => skip(-5)}
          className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center hover:bg-zinc-700 hover:text-zinc-200 transition shrink-0 text-xs"
          title="Skip back 5s (Shift+Left)"
        >
          -5
        </button>

        {/* Play/Pause */}
        <button
          onClick={toggle}
          className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition shrink-0"
          title="Play/Pause (Space)"
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="2" width="4" height="12" />
              <rect x="9" y="2" width="4" height="12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <polygon points="3,1 13,8 3,15" />
            </svg>
          )}
        </button>

        {/* Skip forward */}
        <button
          onClick={() => skip(5)}
          className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center hover:bg-zinc-700 hover:text-zinc-200 transition shrink-0 text-xs"
          title="Skip forward 5s (Shift+Right)"
        >
          +5
        </button>

        {/* Progress bar */}
        <div className="flex-1">
          <div
            ref={barRef}
            className="group h-6 flex items-center cursor-pointer select-none"
            onMouseDown={(e) => {
              setDragging(true);
              seekTo(e.clientX);
            }}
          >
            <div className="w-full h-1.5 group-hover:h-2.5 bg-zinc-700 rounded-full relative transition-all">
              <div
                className="h-full bg-white rounded-full"
                style={{ width: `${pct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${pct}% - 8px)` }}
              />
            </div>
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Speed control */}
        <button
          onClick={cycleSpeed}
          className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition text-xs font-medium shrink-0 min-w-[40px]"
          title="Cycle playback speed"
        >
          {speed}x
        </button>
      </div>

      {transcript && (
        <div className="mt-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
          <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Transcript</p>
          <p className="text-lg text-zinc-100 leading-relaxed">{transcript}</p>
        </div>
      )}
    </div>
  );
}
