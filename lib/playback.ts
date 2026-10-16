import type { ChordVoicing } from "@/lib/voicings";

export const CHORD_DURATION_MS = 1200;
export const SCALE_NOTE_DURATION_MS = 300;

export type PlaybackState =
  | { readonly kind: "idle" }
  | { readonly kind: "preview"; readonly voicingId: string }
  | { readonly kind: "sequence"; readonly voicingId: string; readonly index: number }
  | { readonly kind: "scale"; readonly scaleId: string; readonly index: number };

export interface PlaybackAudio {
  prepare(): Promise<void>;
  play(midiNotes: readonly number[], durationMs: number): void;
  stop(): void;
  dispose(): void;
}

export const GUITAR_SAMPLES = {
  E2: "E2.mp3", A2: "A2.mp3", D3: "D3.mp3", G3: "G3.mp3",
  B3: "B3.mp3", E4: "E4.mp3", A4: "A4.mp3", D5: "D5.mp3",
} as const;

type ToneModule = typeof import("tone");
export type TonePlaybackRuntime = Pick<ToneModule,
  "start" | "now" | "immediate" | "Midi" | "Sampler" | "Gain" | "ToneAudioBuffers">;

/** Browser resources belong to this adapter; Tone's shared context does not. */
export class ToneGuitarPlayback implements PlaybackAudio {
  private tone: TonePlaybackRuntime | undefined;
  private buffers: InstanceType<TonePlaybackRuntime["ToneAudioBuffers"]> | undefined;
  private sampler: InstanceType<TonePlaybackRuntime["Sampler"]> | undefined;
  private output: InstanceType<TonePlaybackRuntime["Gain"]> | undefined;
  private preparation: Promise<void> | undefined;
  private cancelLoading: (() => void) | undefined;
  private generation = 0;

  constructor(private readonly loadTone: () => Promise<TonePlaybackRuntime> = () => import("tone")) {}

  prepare(): Promise<void> {
    if (typeof window === "undefined") return Promise.reject(new Error("Audio playback is unavailable in this browser."));
    if (this.preparation) return this.preparation;
    const generation = this.generation;
    const work = this.initialize(generation);
    this.preparation = work;
    void work.finally(() => {
      if (this.preparation === work) this.preparation = undefined;
    }).catch(() => {});
    return work;
  }

  private async initialize(generation: number) {
    try {
      const tone = await this.loadTone();
      if (generation !== this.generation) return;
      this.tone = tone;
      await tone.start();
      if (generation !== this.generation) return;
      if (!this.buffers) {
        await new Promise<void>((resolve, reject) => {
          this.cancelLoading = resolve;
          this.buffers = new tone.ToneAudioBuffers({
            urls: GUITAR_SAMPLES,
            baseUrl: "/audio/guitar-acoustic/",
            onload: resolve,
            onerror: () => reject(new Error("Guitar samples could not load. Try playing again.")),
          });
        });
        if (generation !== this.generation) return;
        this.cancelLoading = undefined;
      }
      this.createVoice();
    } catch (error) {
      if (generation !== this.generation) return;
      this.dispose();
      throw error;
    }
  }

  private createVoice() {
    if (this.sampler) return;
    const tone = this.tone;
    const buffers = this.buffers;
    if (!tone || !buffers?.loaded) throw new Error("Audio is not ready.");
    const urls = Object.fromEntries(Object.keys(GUITAR_SAMPLES).map((pitch) => [pitch, buffers.get(pitch)]));
    this.output = new tone.Gain(0).toDestination();
    this.sampler = new tone.Sampler({ urls, volume: -12, release: 0.03 }).connect(this.output);
    if (!this.sampler.loaded) throw new Error("Audio is not ready.");
  }

  play(midiNotes: readonly number[], durationMs: number) {
    this.createVoice();
    const tone = this.tone;
    const sampler = this.sampler;
    const output = this.output;
    if (!tone || !sampler || !output) throw new Error("Audio is not ready.");
    output.gain.setValueAtTime(1, tone.immediate());
    const start = tone.now();
    sampler.triggerAttackRelease(midiNotes.map((midi) => tone.Midi(midi).toNote()), durationMs / 1000, start);
  }

  stop() {
    const sampler = this.sampler;
    const output = this.output;
    this.sampler = undefined;
    this.output = undefined;
    if (output && this.tone) output.gain.setValueAtTime(0, this.tone.immediate());
    if (sampler && this.tone) sampler.releaseAll(this.tone.immediate());
    // Retire the entire path: a cancelled future attack can never become audible
    // when the next chord opens its own output gate.
    sampler?.dispose();
    output?.dispose();
  }

  dispose() {
    this.generation += 1;
    this.stop();
    this.cancelLoading?.();
    this.cancelLoading = undefined;
    this.preparation = undefined;
    this.buffers?.dispose();
    this.buffers = undefined;
    this.tone = undefined;
  }
}

const IDLE: PlaybackState = { kind: "idle" };

/** One owner for previews and sequences. Cancellation also invalidates pending resume(). */
export class PlaybackController {
  private state: PlaybackState = IDLE;
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private revision = 0;

  constructor(private readonly audio: PlaybackAudio = new ToneGuitarPlayback()) {}

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

  preview = (voicing: ChordVoicing) => this.start([{ midiNotes: voicing.midiNotes, voicingId: voicing.id }], "preview");
  sequence = (voicings: readonly ChordVoicing[]) => this.start(
    voicings.map((voicing) => ({ midiNotes: voicing.midiNotes, voicingId: voicing.id })), "sequence",
  );
  sequenceNotes = (scaleId: string, midiNotes: readonly number[]) => this.start(
    midiNotes.map((midi) => ({ midiNotes: [midi] })), "scale", scaleId,
  );

  private async start(steps: readonly { midiNotes: readonly number[]; voicingId?: string }[], mode: "preview" | "sequence" | "scale", scaleId?: string) {
    this.stop();
    const revision = this.revision;
    const first = steps[0];
    if (!first) return;
    const stateFor = (step: (typeof steps)[number], index: number): PlaybackState => {
      if (mode === "preview" || mode === "sequence") {
        if (step.voicingId === undefined) throw new Error("Chord playback step is missing its voicing ID.");
        return mode === "preview"
          ? { kind: "preview", voicingId: step.voicingId }
          : { kind: "sequence", voicingId: step.voicingId, index };
      }
      if (scaleId === undefined) throw new Error("Scale playback is missing its scale ID.");
      return { kind: "scale", scaleId, index };
    };
    this.update(stateFor(first, 0));
    try {
      await this.audio.prepare();
      if (revision !== this.revision) return;
      const playAt = (index: number) => {
        if (revision !== this.revision) return;
        const step = steps[index];
        if (!step) { this.stop(); return; }
        this.audio.stop();
        this.update(stateFor(step, index));
        const durationMs = mode === "scale" ? SCALE_NOTE_DURATION_MS : CHORD_DURATION_MS;
        this.audio.play(step.midiNotes, durationMs);
        this.timer = setTimeout(() => {
          try { playAt(index + 1); }
          catch { this.stop(); }
        }, durationMs);
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
