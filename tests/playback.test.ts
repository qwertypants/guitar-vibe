import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CHORD_DURATION_MS, PlaybackController, WebAudioPlayback, type PlaybackAudio } from "@/lib/playback";
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

function param() {
  return { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
}

function oscillatorNode() {
  const onended: (() => void) | null = null;
  return { type: "sine", frequency: param(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended };
}

function gainNode() {
  return { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
}

class FakeContext {
  static instances: FakeContext[] = [];
  state = "suspended";
  currentTime = 10;
  destination = {};
  oscillators: ReturnType<typeof oscillatorNode>[] = [];
  gains: ReturnType<typeof gainNode>[] = [];
  constructor() { FakeContext.instances.push(this); }
  resume = vi.fn(async () => { this.state = "running"; });
  close = vi.fn(async () => { this.state = "closed"; });
  createOscillator() {
    const node = oscillatorNode();
    this.oscillators.push(node);
    return node;
  }
  createGain() {
    const node = gainNode();
    this.gains.push(node);
    return node;
  }
}

describe("Web Audio adapter without hardware", () => {
  test("lazily resumes, converts each exact MIDI pitch, connects to output, and silences nodes", async () => {
    FakeContext.instances = [];
    vi.stubGlobal("AudioContext", FakeContext);
    const output = new WebAudioPlayback();
    expect(FakeContext.instances).toHaveLength(0);
    await output.prepare();
    const context = FakeContext.instances[0];
    if (!context) throw new Error("Missing test context");
    const midi = chord("C")[0].midiNotes;
    output.play(midi, CHORD_DURATION_MS);
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.oscillators).toHaveLength(midi.length);
    context.oscillators.forEach((node, index) => {
      expect(node.frequency.setValueAtTime).toHaveBeenCalledWith(440 * 2 ** ((Number(midi[index]) - 69) / 12), 10);
      expect(node.start).toHaveBeenCalledWith(10);
      expect(node.stop).toHaveBeenCalledWith(11.2);
      expect(context.gains[index]?.connect).toHaveBeenCalledWith(context.destination);
    });
    output.stop();
    output.stop();
    for (const node of context.oscillators) {
      expect(node.disconnect).toHaveBeenCalledOnce();
      expect(node.stop).toHaveBeenLastCalledWith();
    }
    for (const gain of context.gains) expect(gain.disconnect).toHaveBeenCalledOnce();
    output.dispose();
    expect(context.close).toHaveBeenCalledOnce();
    await output.prepare();
    expect(FakeContext.instances).toHaveLength(2);
    output.dispose();
  });

  test("missing browser support fails only on playback, rather than during SSR/import", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const output = new WebAudioPlayback();
    await expect(output.prepare()).rejects.toThrow("unavailable");
    output.dispose();
  });
});
