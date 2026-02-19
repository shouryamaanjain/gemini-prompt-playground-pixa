export interface Metrics {
  single_speaker: boolean;
  speaker_gender: "male" | "female";
  noise_level: "no_noise" | "low" | "high";
  is_artificially_generated: boolean;
  speaking_pace: "very_slow" | "slow" | "normal" | "fast" | "very_fast";
  language_category: "only_hindi" | "hinglish" | "english";
  recording_quality: "studio" | "low_quality";
  word_cutoff: boolean;
}

export interface GeminiResponse extends Metrics {
  transcript: string;
}

export interface Segment {
  video_id: string;
  segment_id: string;
  audio_url: string;
}

export interface Annotation {
  video_id: string;
  segment_id: string;
  user_answers: Metrics;
  gemini_answers: GeminiResponse;
}

export const METRIC_FIELDS: {
  key: keyof Metrics;
  label: string;
  type: "boolean" | "enum";
  options?: string[];
}[] = [
  { key: "single_speaker", label: "Single speaker?", type: "boolean" },
  { key: "speaker_gender", label: "Speaker gender", type: "enum", options: ["male", "female"] },
  { key: "noise_level", label: "Noise level", type: "enum", options: ["no_noise", "low", "high"] },
  { key: "is_artificially_generated", label: "AI generated?", type: "boolean" },
  { key: "speaking_pace", label: "Speaking pace", type: "enum", options: ["very_slow", "slow", "normal", "fast", "very_fast"] },
  { key: "language_category", label: "Language", type: "enum", options: ["only_hindi", "hinglish", "english"] },
  { key: "recording_quality", label: "Recording quality", type: "enum", options: ["studio", "low_quality"] },
  { key: "word_cutoff", label: "Word cutoff?", type: "boolean" },
];
