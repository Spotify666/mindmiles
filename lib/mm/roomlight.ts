'use client';

/**
 * MEASURING THE LIGHT YOU ARE SITTING IN.
 *
 * No browser can read display brightness — there is no API for it on any
 * platform, and the standards proposal that exists is about *setting*
 * brightness, not reading it. So the honest options were: ask the user to type
 * a number in, or leave it out.
 *
 * There is a third, and it needs a permission rather than an API. A camera can
 * see how much light is in the room. One frame, a mean luminance, and you know
 * whether someone is working in a bright office or a dark bedroom — which, for
 * the question the Eyes score is actually asking, is the more useful half. A
 * screen at 80% is unremarkable at midday and punishing at midnight; it is the
 * gap between the screen and the room that tires eyes, and this measures the
 * room.
 *
 * What this deliberately does:
 *
 *   ONE FRAME. The stream is opened, a single frame is sampled at 64×48, and
 *   every track is stopped in the same function. The camera is live for well
 *   under a second and there is no code path that keeps it open.
 *
 *   NEVER STORED, NEVER SENT. The frame goes to an offscreen canvas, becomes
 *   one number, and is discarded. No image is written to storage, and there is
 *   no network call anywhere in this file.
 *
 *   ON DEMAND ONLY. Never on load, never on a timer. A camera that opens by
 *   itself is a camera nobody should trust, whatever it claims to be doing.
 *
 * And what it honestly is not: this measures ROOM light, not screen brightness,
 * and cameras auto-expose, which fights the measurement. Where the browser
 * exposes exposure settings they are used to compensate; where it does not, the
 * reading is cruder. It is labelled estimated either way.
 */

export interface RoomLightReading {
  /** 0–100, comparable to the ambient-sensor scale. */
  value: number;
  /** When it was taken. A reading from this morning is not this evening's room. */
  at: number;
  /** True when the camera exposed its own settings, making this less of a guess. */
  compensated: boolean;
}

export type RoomLightError = 'denied' | 'no-camera' | 'failed' | 'insecure';

/** Cameras need a moment to settle before a frame means anything. */
const SETTLE_MS = 700;
/** A mean needs no resolution at all, and a small frame is a cheap one. */
const SAMPLE_W = 64;
const SAMPLE_H = 48;

export function cameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    (typeof window === 'undefined' || window.isSecureContext)
  );
}

const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

/**
 * Take one reading. Resolves to a reading, or an error describing why not.
 *
 * Must be called from a user gesture — the permission prompt requires one, and
 * more importantly nobody should ever be surprised by this running.
 */
export async function measureRoomLight(): Promise<
  { ok: true; reading: RoomLightReading } | { ok: false; error: RoomLightError }
> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return { ok: false, error: 'insecure' };
  }
  if (!cameraSupported()) return { ok: false, error: 'no-camera' };

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // The front camera faces the room the user is in, which is what we want.
      video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
      audio: false,
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    // Let auto-exposure settle, or the first frame measures the shutter rather
    // than the room.
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_W;
    canvas.height = SAMPLE_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return { ok: false, error: 'failed' };

    ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
    const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);

    // Mean relative luminance, Rec. 709, in linear light.
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = srgbToLinear(data[i] / 255);
      const g = srgbToLinear(data[i + 1] / 255);
      const b = srgbToLinear(data[i + 2] / 255);
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const meanLuma = sum / (data.length / 4);

    // Compensate for the camera's own exposure where it will tell us. A dark
    // room photographed at a long exposure and a bright one at a short exposure
    // can produce the same pixels; dividing back out recovers some of the
    // difference. Support is patchy, so the reading says whether it happened.
    const track = stream.getVideoTracks()[0];
    const settings = (track?.getSettings?.() ?? {}) as {
      exposureTime?: number;
      iso?: number;
    };
    const exposure = settings.exposureTime;
    const iso = settings.iso;
    const compensated = typeof exposure === 'number' && exposure > 0;

    let scene = meanLuma;
    if (compensated) {
      // exposureTime arrives in 100µs units per the image-capture spec.
      const seconds = (exposure * 100) / 1_000_000;
      const gain = (iso ?? 100) / 100;
      // Normalised against a nominal 1/60s at ISO 100 so the result stays on a
      // human scale rather than becoming an absolute photometric figure, which
      // this is emphatically not.
      scene = meanLuma / Math.max(seconds * 60 * gain, 0.01);
    }

    return {
      ok: true,
      reading: { value: toScale(scene), at: Date.now(), compensated },
    };
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return { ok: false, error: 'denied' };
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return { ok: false, error: 'no-camera' };
    }
    return { ok: false, error: 'failed' };
  } finally {
    // Unconditionally, on every path including a thrown error. The camera must
    // never outlive this function.
    stream?.getTracks().forEach((t) => t.stop());
  }
}

/**
 * Map scene luminance onto the same 0–100 scale the ambient sensor uses.
 *
 * Logarithmic, because eyes are: the step from a dark room to a lamp matters far
 * more than the step from a bright office to a brighter one.
 */
function toScale(scene: number): number {
  const clamped = Math.max(scene, 0.0001);
  const t = (Math.log10(clamped) + 3) / 3.3;
  return Math.round(Math.max(0, Math.min(1, t)) * 100);
}

export const ERROR_COPY: Record<RoomLightError, string> = {
  denied:
    'Your browser said no to the camera. Nothing is broken — brightness just stays out of your Eyes score.',
  'no-camera': 'No camera we can use on this device.',
  insecure: 'This needs a secure connection (https) before a browser will allow the camera.',
  failed: 'That did not work. Nothing was captured.',
};
