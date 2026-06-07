export class Recorder {
  private mediaStream?: MediaStream;
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private rafId?: number;
  private listener?: (level: number) => void;

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone API not available in this browser.");
    }
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    this.recorder = new MediaRecorder(this.mediaStream, { mimeType: mime });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();

    // Live level analysis
    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
    this.loop();
  }

  /** Subscribe to live volume updates (0..1) while recording. */
  onLevel(cb: (level: number) => void) { this.listener = cb; }

  private loop = () => {
    if (!this.analyser) return;
    const buf = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(buf);
    // Compute RMS of the deviation from 128 (silence center)
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const d = (buf[i] - 128) / 128;
      sum += d * d;
    }
    const rms = Math.sqrt(sum / buf.length);
    const level = Math.min(1, rms * 2.4); // mild scale-up
    this.listener?.(level);
    this.rafId = requestAnimationFrame(this.loop);
  };

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.recorder) return reject(new Error("Not recording"));
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.recorder!.mimeType });
        this.cleanup();
        resolve(blob);
      };
      this.recorder.onerror = (e) => { this.cleanup(); reject(e); };
      this.recorder.stop();
    });
  }

  /** Stop recording and discard audio. No promise of a blob. */
  cancel() {
    try { this.recorder?.stop(); } catch { /* ignore */ }
    this.cleanup();
  }

  private cleanup() {
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    this.rafId = undefined;
    this.analyser?.disconnect();
    this.analyser = undefined;
    void this.audioCtx?.close();
    this.audioCtx = undefined;
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = undefined;
    this.recorder = undefined;
    this.listener = undefined;
  }

  isRecording() {
    return this.recorder?.state === "recording";
  }
}

export async function playBlob(blob: Blob): Promise<HTMLAudioElement> {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener("ended", () => URL.revokeObjectURL(url));
  await audio.play();
  return audio;
}
