import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Recorder, playBlob } from "../src/audio";

/* ---------- Minimal mocks for MediaRecorder + AudioContext ---------- */

class FakeAudioParam {
  value = 0;
}
class FakeAnalyser {
  fftSize = 256;
  frequencyBinCount = 128;
  connect = vi.fn();
  disconnect = vi.fn();
  getByteTimeDomainData(buf: Uint8Array) {
    // Simulate a small waveform around 128 (silence center)
    for (let i = 0; i < buf.length; i++) buf[i] = 128 + (i % 8);
  }
}
class FakeMediaStreamSource {
  connect = vi.fn();
}
class FakeAudioContext {
  state = "running";
  createMediaStreamSource() { return new FakeMediaStreamSource(); }
  createAnalyser() { return new FakeAnalyser(); }
  close = vi.fn(async () => undefined);
  // audio param shim
  destination = {} as unknown as FakeAudioParam;
}

class FakeMediaStream {
  active = true;
  tracks = [{ stop: vi.fn() }];
  getTracks() { return this.tracks; }
}

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  state: "inactive" | "recording" | "stopped" = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: ((e: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  constructor(public stream: MediaStream, public opts?: MediaRecorderOptions) {
    this.mimeType = opts?.mimeType ?? this.mimeType;
  }
  start() {
    this.state = "recording";
    queueMicrotask(() => {
      const ev = { data: new Blob(["bytes"], { type: this.mimeType }), size: 5 } as unknown as BlobEvent;
      this.ondataavailable?.(ev);
    });
  }
  stop() {
    this.state = "stopped";
    queueMicrotask(() => this.onstop?.());
  }
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).MediaRecorder = FakeMediaRecorder as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).AudioContext = FakeAudioContext as any;
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => new FakeMediaStream() as unknown as MediaStream),
    },
  });
  // raf shim
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as unknown as number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Recorder", () => {
  it("throws helpful error when getUserMedia is missing", async () => {
    Object.defineProperty(globalThis.navigator, "mediaDevices", { configurable: true, value: undefined });
    const r = new Recorder();
    await expect(r.start()).rejects.toThrow(/Microphone API not available/);
  });

  it("start() acquires mic, recorder enters recording state", async () => {
    const r = new Recorder();
    await r.start();
    expect(r.isRecording()).toBe(true);
  });

  it("stop() resolves with a non-empty Blob", async () => {
    const r = new Recorder();
    await r.start();
    // give microtask for ondataavailable
    await new Promise((res) => setTimeout(res, 10));
    const blob = await r.stop();
    expect(blob.size).toBeGreaterThan(0);
    expect(r.isRecording()).toBe(false);
  });

  it("cancel() releases resources without producing a blob", async () => {
    const r = new Recorder();
    await r.start();
    r.cancel();
    expect(r.isRecording()).toBe(false);
  });

  it("onLevel() callback fires while recording", async () => {
    const r = new Recorder();
    const cb = vi.fn();
    await r.start();
    r.onLevel(cb);
    // wait for at least one RAF tick
    await new Promise((res) => setTimeout(res, 30));
    await r.stop();
    expect(cb).toHaveBeenCalled();
    const lastCall = cb.mock.calls[cb.mock.calls.length - 1];
    const sample = lastCall?.[0];
    expect(typeof sample).toBe("number");
    expect(sample).toBeGreaterThanOrEqual(0);
    expect(sample).toBeLessThanOrEqual(1);
  });

  it("stop() before start rejects", async () => {
    const r = new Recorder();
    await expect(r.stop()).rejects.toThrow(/Not recording/);
  });
});

describe("playBlob()", () => {
  it("creates an Audio element and calls play()", async () => {
    const playSpy = vi.fn(async () => undefined);
    class FakeAudio {
      src: string;
      addEventListener = vi.fn();
      play = playSpy;
      constructor(src: string) { this.src = src; }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Audio = FakeAudio as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.URL as any).createObjectURL = vi.fn(() => "blob:fake");

    const audio = await playBlob(new Blob(["data"]));
    expect(playSpy).toHaveBeenCalledOnce();
    expect((audio as unknown as FakeAudio).src).toBe("blob:fake");
  });
});
