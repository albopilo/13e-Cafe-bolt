// Web Audio API-based notification ringtone — no external file needed.
// Produces a repeating bell-like tone that works on all browsers.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Call this from a user gesture (click/tap) to unlock audio on mobile browsers.
export function unlockAudio(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  // Play a silent blip to fully unlock
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch {
    // ignore
  }
}

function playBellTone(ctx: AudioContext, startTime: number, freq: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);
  // Bell-like decay envelope
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.8, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + 1.3);

  // Add a harmonic for a richer bell sound
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2, startTime);
  gain2.gain.setValueAtTime(0, startTime);
  gain2.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
  gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(startTime);
  osc2.stop(startTime + 0.9);
}

// Plays a ringing bell pattern: 3 bell strikes, repeated.
// Returns the total duration in ms.
export function playNotificationRing(): number {
  const ctx = getCtx();
  if (!ctx) return 0;

  const now = ctx.currentTime;
  // Three bell strikes with slight pitch variation
  playBellTone(ctx, now, 880);
  playBellTone(ctx, now + 0.4, 880);
  playBellTone(ctx, now + 0.8, 988);

  return 2000;
}

// Repeating ring — keeps ringing until stopped. Returns a stop function.
export function startRepeatingRing(intervalMs = 3000): () => void {
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const ring = () => {
    if (stopped) return;
    playNotificationRing();
    timeoutId = setTimeout(ring, intervalMs);
  };

  ring();

  return () => {
    stopped = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
}
