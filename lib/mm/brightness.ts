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

export type BrightnessSource = 'native' | 'sensor' | 'declared';

export interface BrightnessReading {
  /** 0–100. */
  value: number;
  source: BrightnessSource;
  /** Room illuminance in lux, when a sensor is genuinely present. */
  lux?: number;
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

/** Start any background source. Safe to call repeatedly. */
export function initBrightness(): void {
  if (hasAmbientSensor()) startSensor();
}

/** The strongest reading available right now. */
export async function readBrightness(declared: number): Promise<BrightnessReading> {
  const native = await readNative();
  if (native !== null) return { value: native, source: 'native' };
  if (lastLux !== null) {
    return { value: luxToScale(lastLux), source: 'sensor', lux: Math.round(lastLux) };
  }
  return { value: declared, source: 'declared' };
}

export const SOURCE_LABEL: Record<BrightnessSource, string> = {
  native: 'Measured · display',
  sensor: 'Measured · ambient',
  declared: 'Declared by you',
};

export const SOURCE_NOTE: Record<BrightnessSource, string> = {
  native: 'Read from the display itself. This is real hardware brightness.',
  sensor:
    'Read from the ambient light sensor. It measures the light in your room rather than your screen — a bright screen in a dark room is the combination that strains an eye.',
  declared:
    'No browser can read display brightness, on any platform, so this is the value you set. It is used for Visual Load and always labelled as declared rather than measured.',
};
