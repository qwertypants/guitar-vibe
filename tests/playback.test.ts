import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CHORD_DURATION_MS, SCALE_NOTE_DURATION_MS, PlaybackController, ToneGuitarPlayback, type TonePlaybackRuntime, type PlaybackAudio } from "@/lib/playback";
import { SUPPORTED_CHORDS } from "@/lib/chords";
import { resolveChord } from "@/lib/voicings";

function chord(symbol: string) {
  const result = resolveChord(symbol);
  if (result.kind !== "resolved") throw new Error(`Missing ${symbol}`);
  return result.voicings;
}

function audio() {
  return { prepare: vi.fn(async () => {}), play: vi.fn(), stop: vi.fn(), dispose: vi.fn() } satisfies PlaybackAudio;
}

function secondPosition(symbol: string) {
  const position = chord(symbol)[1];
  if (!position) throw new Error(`Missing second position for ${symbol}`);
  return position;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("exclusive playback controller", () => {
  test("every catalog position plays its exact MIDI notes and stops individually", async () => {
    const output = audio();
    const controller = new PlaybackController(output);
    for (const { symbol } of SUPPORTED_CHORDS) {
      for (const voicing of chord(symbol)) {
        await controller.preview(voicing);
        expect(output.play).toHaveBeenLastCalledWith(voicing.midiNotes, CHORD_DURATION_MS);
        expect(controller.getState()).toEqual({ kind: "preview", voicingId: voicing.id });
        controller.stop();
        expect(controller.getState()).toEqual({ kind: "idle" });
      }
    }
    const count = output.play.mock.calls.length;
    vi.runAllTimers();
    expect(output.play).toHaveBeenCalledTimes(count);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("sequence uses selected positions in displayed order, including repeated chords", async () => {
    const selected = [secondPosition("C"), chord("G")[0], secondPosition("Am"), chord("C")[0]];
    const output = audio();
    const controller = new PlaybackController(output);
    await controller.sequence(selected);
    expect(output.play.mock.calls.map(([notes]) => notes)).toEqual([selected[0]?.midiNotes]);
    await vi.advanceTimersByTimeAsync(CHORD_DURATION_MS * selected.length);
    expect(output.play.mock.calls.map(([notes]) => notes)).toEqual(selected.map((voicing) => voicing.midiNotes));
    expect(controller.getState()).toEqual({ kind: "idle" });
    expect(vi.getTimerCount()).toBe(0);
  });

  test("scale playback plays unique pitches in ascending order and can be cancelled", async () => {
    const output = audio();
    const controller = new PlaybackController(output);
    await controller.sequenceNotes("C-major", [40, 43, 45]);
    expect(output.play).toHaveBeenLastCalledWith([40], SCALE_NOTE_DURATION_MS);
    expect(controller.getState()).toEqual({ kind: "scale", scaleId: "C-major", index: 0 });
    await vi.advanceTimersByTimeAsync(SCALE_NOTE_DURATION_MS);
    expect(output.play).toHaveBeenLastCalledWith([43], SCALE_NOTE_DURATION_MS);
    expect(controller.getState()).toEqual({ kind: "scale", scaleId: "C-major", index: 1 });
    controller.stop();
    await vi.advanceTimersByTimeAsync(SCALE_NOTE_DURATION_MS * 3);
    expect(output.play).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toEqual({ kind: "idle" });
  });

  test("switching modes silences the old notes and cancels all remaining sequence steps", async () => {
    const output = audio();
    const controller = new PlaybackController(output);
    const voicings = chord("C");
    await controller.sequence(voicings);
    output.stop.mockClear();
    await controller.preview(chord("G")[0]);
    expect(output.stop).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(CHORD_DURATION_MS * 5);
    expect(output.play).toHaveBeenCalledTimes(2);
    await controller.preview(voicings[0]);
    await controller.sequence(voicings);
    expect(controller.getState().kind).toBe("sequence");
    controller.stop();
    await vi.advanceTimersByTimeAsync(CHORD_DURATION_MS * 5);
    expect(output.play).toHaveBeenCalledTimes(4);
  });

  test("stop, replacement, and disposal invalidate audio still waiting for browser permission", async () => {
    const output = audio();
    const resumes: Array<() => void> = [];
    output.prepare.mockImplementation(() => new Promise<void>((resolve) => resumes.push(resolve)));
    const controller = new PlaybackController(output);
    const stopped = controller.preview(chord("C")[0]);
    controller.stop();
    resumes[0]?.();
    await stopped;
    expect(output.play).not.toHaveBeenCalled();
    const old = controller.sequence(chord("C"));
    const next = controller.preview(chord("G")[0]);
    resumes[2]?.();
    await next;
    resumes[1]?.();
    await old;
    expect(output.play).toHaveBeenCalledTimes(1);
    const unmounted = controller.preview(chord("C")[0]);
    controller.dispose();
    resumes[3]?.();
    await unmounted;
    expect(output.play).toHaveBeenCalledTimes(1);
    expect(output.dispose).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  test("resume failure returns to idle; empty sequences and repeated cleanup are safe", async () => {
    const output = audio();
    const controller = new PlaybackController(output);
    output.prepare.mockRejectedValueOnce(new Error("blocked"));
    await expect(controller.preview(chord("C")[0])).rejects.toThrow("blocked");
    expect(controller.getState()).toEqual({ kind: "idle" });
    await controller.sequence([]);
    controller.dispose();
    controller.dispose();
    expect(output.play).not.toHaveBeenCalled();
  });
});

function runtime() {
  const banks: FakeBuffers[] = [];
  const samplers: FakeSampler[] = [];
  const gains: FakeGain[] = [];
  class FakeBuffers {
    loaded = false;
    dispose = vi.fn();
    get = vi.fn((pitch: string) => ({ pitch }));
    constructor(readonly options: { onload: () => void; onerror: () => void; urls: unknown; baseUrl: string }) { banks.push(this); }
    load() { this.loaded = true; this.options.onload(); }
  }
  class FakeSampler {
    loaded = true;
    triggerAttackRelease = vi.fn();
    releaseAll = vi.fn();
    dispose = vi.fn();
    connect = vi.fn(() => this);
    constructor(readonly options: { urls: unknown; volume: number; release: number }) { samplers.push(this); }
  }
  class FakeGain {
    gain = { setValueAtTime: vi.fn() };
    dispose = vi.fn();
    toDestination = vi.fn(() => this);
    constructor(readonly value: number) { gains.push(this); }
  }
  const tone = {
    start: vi.fn(async () => {}), now: vi.fn(() => 10.1), immediate: vi.fn(() => 10),
    Midi: vi.fn((midi: number) => ({ toNote: () => `note-${midi}` })),
    Sampler: FakeSampler, Gain: FakeGain, ToneAudioBuffers: FakeBuffers,
  };
  // The fake implements only the public surface consumed by this adapter.
  const load = vi.fn(async () => tone as unknown as TonePlaybackRuntime);
  return { tone, load, banks, samplers, gains };
}
async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }
async function ready(output: ToneGuitarPlayback, fake: ReturnType<typeof runtime>) {
  const preparing = output.prepare();
  await flush();
  fake.banks.at(-1)!.load();
  await preparing;
}

describe("Tone guitar adapter", () => {
  test("construction is SSR safe and missing browser fails only on prepare", async () => {
    vi.stubGlobal("window", undefined);
    const fake = runtime();
    const output = new ToneGuitarPlayback(fake.load);
    expect(fake.load).not.toHaveBeenCalled();
    await expect(output.prepare()).rejects.toThrow("unavailable");
    output.dispose();
  });

  test("shares loading, maps eight samples, and plays simultaneous exact MIDI pitches", async () => {
    const fake = runtime();
    const output = new ToneGuitarPlayback(fake.load);
    const first = output.prepare();
    expect(output.prepare()).toBe(first);
    await flush();
    expect(fake.tone.start).toHaveBeenCalledOnce();
    expect(fake.samplers).toHaveLength(0);
    expect(fake.banks[0]!.options.baseUrl).toBe("/audio/guitar-acoustic/");
    expect(fake.banks[0]!.options.urls).toEqual({ E2: "E2.mp3", A2: "A2.mp3", D3: "D3.mp3", G3: "G3.mp3", B3: "B3.mp3", E4: "E4.mp3", A4: "A4.mp3", D5: "D5.mp3" });
    fake.banks[0]!.load();
    await first;
    output.play([40, 55, 64], 1200);
    expect(fake.samplers[0]!.options).toMatchObject({ volume: -12, release: 0.03 });
    expect(fake.samplers[0]!.triggerAttackRelease).toHaveBeenCalledWith(["note-40", "note-55", "note-64"], 1.2, 10.1);
    expect(fake.gains[0]!.gain.setValueAtTime).toHaveBeenCalledWith(1, 10);
    output.dispose();
  });

  test("stop retires future voices permanently; next play reuses buffers with a fresh muted path", async () => {
    const fake = runtime();
    const output = new ToneGuitarPlayback(fake.load);
    await ready(output, fake);
    output.stop(); // Controller stops immediately before its first play.
    output.play([40], 1200);
    const old = fake.samplers.at(-1)!;
    const oldGain = fake.gains.at(-1)!;
    output.stop();
    output.stop();
    expect(old.releaseAll).toHaveBeenCalledWith(10);
    expect(old.dispose).toHaveBeenCalledOnce();
    expect(oldGain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10);
    expect(oldGain.dispose).toHaveBeenCalledOnce();
    output.play([64], 1200);
    expect(fake.samplers.at(-1)).not.toBe(old);
    expect(fake.banks).toHaveLength(1);
    expect(oldGain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10);
    output.dispose();
  });

  test("stop during loading permits a replacement prepare to share samples without playing", async () => {
    const fake = runtime();
    const output = new ToneGuitarPlayback(fake.load);
    const first = output.prepare();
    await flush();
    output.stop();
    expect(output.prepare()).toBe(first);
    fake.banks[0]!.load();
    await first;
    expect(fake.samplers[0]!.triggerAttackRelease).not.toHaveBeenCalled();
    output.play([40], 1200);
    output.dispose();
  });

  test("controller replacement during sample loading plays only the latest chord", async () => {
    const fake = runtime();
    const output = new ToneGuitarPlayback(fake.load);
    const controller = new PlaybackController(output);
    const old = controller.preview(chord("C")[0]);
    await flush();
    const latest = controller.preview(chord("G")[0]);
    fake.banks[0]!.load();
    await Promise.all([old, latest]);
    const attacks = fake.samplers.flatMap((sampler) => sampler.triggerAttackRelease.mock.calls);
    expect(attacks).toEqual([[chord("G")[0].midiNotes.map((midi) => `note-${midi}`), 1.2, 10.1]]);
    expect(controller.getState()).toEqual({ kind: "preview", voicingId: chord("G")[0].id });
    controller.dispose();
  });

  test("sample failure cleans owned resources and retries", async () => {
    const fake = runtime();
    const output = new ToneGuitarPlayback(fake.load);
    const first = output.prepare();
    await flush();
    fake.banks[0]!.options.onerror();
    await expect(first).rejects.toThrow("samples");
    expect(fake.banks[0]!.dispose).toHaveBeenCalledOnce();
    await ready(output, fake);
    output.dispose();
  });

  test("unlock and module failures retry", async () => {
    const fake = runtime();
    const output = new ToneGuitarPlayback(fake.load);
    fake.load.mockRejectedValueOnce(new Error("import failed"));
    await expect(output.prepare()).rejects.toThrow("import failed");
    fake.tone.start.mockRejectedValueOnce(new Error("blocked"));
    await expect(output.prepare()).rejects.toThrow("blocked");
    await ready(output, fake);
    output.dispose();
  });

  test("dispose cancels stale loading and supports Strict Mode reuse", async () => {
    const fake = runtime();
    const output = new ToneGuitarPlayback(fake.load);
    const stale = output.prepare();
    await flush();
    output.dispose();
    output.dispose();
    await stale;
    expect(fake.banks[0]!.dispose).toHaveBeenCalledOnce();
    await ready(output, fake);
    fake.banks[0]!.load(); // A late callback cannot replace current resources.
    await flush();
    output.play([40], 1200);
    expect(fake.samplers).toHaveLength(1);
    output.dispose();
  });

  test("dispose invalidates a pending import or unlock", async () => {
    const fake = runtime();
    let resolveImport!: (tone: TonePlaybackRuntime) => void;
    fake.load.mockImplementationOnce(() => new Promise((resolve) => { resolveImport = resolve; }));
    const output = new ToneGuitarPlayback(fake.load);
    const stale = output.prepare();
    output.dispose();
    resolveImport(fake.tone as unknown as TonePlaybackRuntime);
    await stale;
    expect(fake.tone.start).not.toHaveBeenCalled();
    let unlock!: () => void;
    fake.tone.start.mockImplementationOnce(() => new Promise<void>((resolve) => { unlock = resolve; }));
    const pending = output.prepare();
    await flush();
    output.dispose();
    unlock();
    await pending;
    expect(fake.banks).toHaveLength(0);
    await ready(output, fake);
    output.dispose();
  });
});
