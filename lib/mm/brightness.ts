'use client';

/**
 * Brightness capture, and an honest account of what it is.
 *
 * Screen brightness is the one input on this page a browser genuinely cannot
 * read. There is no web API for it on any platform, and there is not going to
 * be one, because it is a fingerprinting surface. The constraint is the
 * sandbox, not the device — so this module tries the strongest source actually
 * present and always reports which one won:
 *
 *   native   Real hardware brightness, read through a companion native shell
 *            when the app is running inside one. A PWA added to the home
 *            screen is still a browser and lands on `declared`, not here.
 *
 *   sensor   Ambient Light Sensor, in lux. Chrome on Android, and only behind
 *            the generic-sensor flag, so it is rare. It measures ROOM light
 *            rather than the screen — which is arguably the more useful of the
 *            two, since a bright screen in a dark room is what strains an eye.
 *
 *   declared The value the user set. Always available, always labelled.
 *
 * Visual Load is scored from whichever of these is live, and the provenance
 * travels with the number into every card that shows it.
 */

/**
 * `unset` is the honest default. There is no web API for display brightness on
 * any platform, so if no sensor answers we do not have a value — and inventing
 * one, or nagging the user to type one in, are both worse than saying so and
 * dropping the input from the score.
 */
export type BrightnessSource = 'native' | 'sensor' | 'camera' | 'declared' | 'unset';

export interface BrightnessReading {
  /** 0–100. Meaningless when `source` is `unset` — check before using it. */
  value: number;
  source: BrightnessSource;
  /** Room illuminance in lux, when a sensor is genuinely present. */
  lux?: number;
}

/** True when we actually know something, rather than having been told. */
export function isMeasured(source: BrightnessSource): boolean {
  return source === 'native' || source === 'sensor' || source === 'camera';
}

/**
 * A camera reading, once taken, stands until it is taken again — asking for the
 * camera on a timer would be intolerable, and a room does not change by the
 * minute. It expires after a day so this evening is never scored against this
 * morning's light.
 */
const CAMERA_TTL_MS = 24 * 60 * 60 * 1000;

let cameraReading: { value: number; at: number } | null = null;

export function setCameraReading(value: number, at: number): void {
  cameraReading = { value, at };
}

export function clearCameraReading(): void {
  cameraReading = null;
}

export function currentCameraReading(): { value: number; at: number } | null {
  if (!cameraReading) return null;
  if (Date.now() - cameraReading.at > CAMERA_TTL_MS) return null;
  return cameraReading;
}

/** The shape a native shell is expected to expose, if one is ever attached. */
interface NativeBridge {
  isNativePlatform?: () => boolean;
  Plugins?: {
    ScreenBrightness?: { getBrightness: () => Promise<{ brightness: number }> };
  };
}

function bridge(): NativeBridge | undefined {
  return (globalThis as unknown as { Capacitor?: NativeBridge }).Capacitor;
}

export function isNativeShell(): boolean {
  return Boolean(bridge()?.isNativePlatform?.());
}

export function hasNativeBrightness(): boolean {
  return Boolean(isNativeShell() && bridge()?.Plugins?.ScreenBrightness);
}

async function readNative(): Promise<number | null> {
  const plugin = bridge()?.Plugins?.ScreenBrightness;
  if (!plugin) return null;
  try {
    const { brightness } = await plugin.getBrightness();
    if (typeof brightness !== 'number' || Number.isNaN(brightness)) return null;
    // Reported 0–1. Android returns -1 for "follow system", which is not a reading.
    if (brightness < 0) return null;
    return Math.round(Math.max(0, Math.min(1, brightness)) * 100);
  } catch {
    return null;
  }
}

// ── Ambient light sensor ──────────────────────────────────────────

type SensorCtor = new (opts: { frequency: number }) => {
  illuminance: number;
  addEventListener: (t: string, cb: () => void) => void;
  start: () => void;
  stop: () => void;
};

let sensor: InstanceType<SensorCtor> | null = null;
let lastLux: number | null = null;

export function hasAmbientSensor(): boolean {
  return typeof window !== 'undefined' && 'AmbientLightSensor' in window;
}

function startSensor(): void {
  if (sensor || !hasAmbientSensor()) return;
  try {
    const Ctor = (window as unknown as { AmbientLightSensor: SensorCtor }).AmbientLightSensor;
    const s = new Ctor({ frequency: 1 });
    s.addEventListener('reading', () => {
      lastLux = s.illuminance;
    });
    s.addEventListener('error', () => {
      sensor = null;
    });
    s.start();
    sensor = s;
  } catch {
    // Permission denied or the flag is off. Fall through to declared.
    sensor = null;
  }
}

/**
 * Map room illuminance onto a 0–100 scale. This is not a brightness reading —
 * it is a proxy for how hard the eye is working against ambient light.
 * ~10 lux is a dim room, ~400 an office, ~10,000 overcast daylight, so the
 * curve is logarithmic to match how the eye actually responds.
 */
function luxToScale(lux: number): number {
  if (lux <= 0) return 0;
  const t = Math.log10(lux + 1) / Math.log10(10001);
  return Math.round(Math.max(0, Math.min(1, t)) * 100);
}

/**
 * Start any background source. Safe to call repeatedly.
 *
 * Attempted automatically on load rather than waiting to be asked — the point
 * is that nobody should have to tell the app how bright their screen is. Where
 * a sensor exists it just works; where it does not, nothing is prompted and the
 * input is simply dropped.
 */
export function initBrightness(): void {
  if (hasAmbientSensor()) startSensor();
}

/**
 * Ask for the ambient light permission explicitly. Some browsers gate the
 * sensor behind a prompt that needs a user gesture, so this is wired to the same
 * button that turns on device-wide counting.
 */
export async function requestAmbientSensor(): Promise<boolean> {
  if (!hasAmbientSensor()) return false;
  try {
    const status = await navigator.permissions?.query({
      name: 'ambient-light-sensor' as PermissionName,
    });
    if (status && status.state === 'denied') return false;
  } catch {
    // Permissions API does not know this name in every browser; try anyway.
  }
  startSensor();
  // The sensor needs a moment to produce its first reading.
  await new Promise((r) => setTimeout(r, 600));
  return lastLux !== null;
}

/**
 * The strongest reading available right now.
 *
 * `declared` is only used when the user has actually set something. Passing
 * null means they have not, and the answer is `unset` rather than a made-up
 * middle value — the metric that consumes this drops the input entirely.
 */
export async function readBrightness(declared: number | null): Promise<BrightnessReading> {
  const native = await readNative();
  if (native !== null) return { value: native, source: 'native' };
  // A live sensor beats a stored camera reading: it is current, and it did not
  // cost anyone their camera.
  if (lastLux !== null) {
    return { value: luxToScale(lastLux), source: 'sensor', lux: Math.round(lastLux) };
  }
  const cam = currentCameraReading();
  if (cam) return { value: cam.value, source: 'camera' };
  if (declared !== null) return { value: declared, source: 'declared' };
  return { value: 0, source: 'unset' };
}

export const SOURCE_LABEL: Record<BrightnessSource, string> = {
  native: 'Read from your screen',
  sensor: 'Read from your room',
  camera: 'Measured from your room',
  declared: 'You told us',
  unset: "Can't read it",
};

export const SOURCE_NOTE: Record<BrightnessSource, string> = {
  native: 'Taken straight from your screen. This is the real thing.',
  sensor:
    'Taken from your device’s light sensor. It measures the light in the room rather than the screen — and a bright screen in a dark room is the combination that tires eyes out.',
  declared:
    'This is the number you typed in. No web page can read your screen brightness on any device, so we never pretend we measured it — and if you would rather not guess, we can read the light in your room from one camera frame instead.',
  camera:
    'Measured with one frame from your camera, then discarded — we looked at how much light is in your room, not at you. Cameras adjust their own exposure, so treat this as a good indication rather than an exact figure.',
  unset:
    'No web browser can read screen brightness, on any device — and your device has no light sensor we can use either. So we leave it out of your Eyes score rather than guessing or asking you to type in a number. You can measure your room light instead, if you want to.',
};
