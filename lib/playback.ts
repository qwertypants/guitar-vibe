import type { ChordVoicing } from "@/lib/voicings";

export const CHORD_DURATION_MS = 1200;

export type PlaybackState =
  | { readonly kind: "idle" }
  | { readonly kind: "preview"; readonly voicingId: string }
  | { readonly kind: "sequence"; readonly voicingId: string; readonly index: number };

export interface PlaybackAudio {
  prepare(): Promise<void>;
  play(midiNotes: readonly number[], durationMs: number): void;
  stop(): void;
  dispose(): void;
}

/** No browser globals or audio resources are accessed until a user starts playback. */
export class WebAudioPlayback implements PlaybackAudio {
  private context: AudioContext | undefined;
  private readonly voices = new Set<() => void>();

  constructor(private readonly createContext: () => AudioContext = () => {
    if (typeof window === "undefined" || !window.AudioContext) {
      throw new Error("Audio playback is unavailable in this browser.");
    }
    return new window.AudioContext();
  }) {}

  async prepare() {
    this.context ??= this.createContext();
    await this.context.resume();
    if (this.context?.state !== "running") {
      throw new Error("Audio could not start. Try playing again.");
    }
  }

  play(midiNotes: readonly number[], durationMs: number) {
    const context = this.context;
    if (!context || context.state !== "running") throw new Error("Audio is not ready.");
    const start = context.currentTime;
    const end = start + durationMs / 1000;
    for (const midi of midiNotes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18 / Math.max(1, midiNotes.length), start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, end - 0.03);
      gain.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      const release = () => {
        if (!this.voices.delete(release)) return;
        // Disconnect first: Stop silences even a note with a scheduled future envelope.
        gain.disconnect();
        oscillator.disconnect();
        oscillator.onended = null;
        oscillator.stop();
      };
      this.voices.add(release);
      oscillator.onended = release;
      oscillator.start(start);
      oscillator.stop(end);
    }
  }

  stop() {
    for (const release of this.voices) release();
  }

  dispose() {
    this.stop();
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }
}

const IDLE: PlaybackState = { kind: "idle" };

/** One owner for previews and sequences. Cancellation also invalidates pending resume(). */
export class PlaybackController {
  private state: PlaybackState = IDLE;
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private revision = 0;

  constructor(private readonly audio: PlaybackAudio = new WebAudioPlayback()) {}

  getState = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(state: PlaybackState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  stop = () => {
    this.revision += 1;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.audio.stop();
    this.update(IDLE);
  };

  preview = (voicing: ChordVoicing) => this.start([voicing], "preview");
  sequence = (voicings: readonly ChordVoicing[]) => this.start([...voicings], "sequence");

  private async start(voicings: readonly ChordVoicing[], mode: "preview" | "sequence") {
    this.stop();
    const revision = this.revision;
    const first = voicings[0];
    if (!first) return;
    this.update(mode === "preview"
      ? { kind: "preview", voicingId: first.id }
      : { kind: "sequence", voicingId: first.id, index: 0 });
    try {
      await this.audio.prepare();
      if (revision !== this.revision) return;
      const playAt = (index: number) => {
        if (revision !== this.revision) return;
        const voicing = voicings[index];
        if (!voicing) { this.stop(); return; }
        this.audio.stop();
        this.update(mode === "preview"
          ? { kind: "preview", voicingId: voicing.id }
          : { kind: "sequence", voicingId: voicing.id, index });
        this.audio.play(voicing.midiNotes, CHORD_DURATION_MS);
        this.timer = setTimeout(() => {
          try { playAt(index + 1); }
          catch { this.stop(); }
        }, CHORD_DURATION_MS);
      };
      playAt(0);
    } catch (error) {
      if (revision !== this.revision) return;
      this.stop();
      throw error;
    }
  }

  /** Reusable after cleanup so React Strict Mode's effect replay can start fresh audio. */
  dispose = () => {
    this.stop();
    this.audio.dispose();
  };
}
