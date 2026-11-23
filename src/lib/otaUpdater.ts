import { CapacitorHttp } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isNativePlatform } from './native.ts';

export const APP_VERSION = '1.0.2';

export const OTA_MANIFEST_URL =
  'https://github.com/Anoof1895/koshaaru/releases/latest/download/ota-manifest.json';

export interface OtaManifest {
  version: string;
  url: string;
  sha256: string;
  publishedAt?: string;
  notes?: string;
}

export type OtaCheckStatus =
  | 'up-to-date'
  | 'downloaded'
  | 'update-available-web'
  | 'error';

export interface OtaCheckResult {
  status: OtaCheckStatus;
  currentVersion: string;
  latestVersion?: string;
  bundleId?: string;
  messageEn: string;
  messageDv: string;
}

function parseSemverParts(version: string): [number, number, number] | null {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/i.exec(
    (version || '').trim()
  );
  if (!match) return null;
  return [
    Number(match[1]),
    Number(match[2] ?? 0),
    Number(match[3] ?? 0),
  ];
}

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

/**
 * Compares two semantic version strings (ignoring any leading `v` or pre-release suffix).
 * Returns 1 if a > b, -1 if a < b, 0 if equal or unparseable.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemverParts(a);
  const pb = parseSemverParts(b);
  if (!pa || !pb) return 0;

  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

export function isValidOtaManifest(raw: unknown): raw is OtaManifest {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.version !== 'string' || !parseSemverParts(obj.version)) {
    return false;
  }
  if (typeof obj.url !== 'string' || !/^https:\/\/.+/i.test(obj.url.trim())) {
    return false;
  }
  if (
    typeof obj.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(obj.sha256.trim())
  ) {
    return false;
  }
  return true;
}

/**
 * Marks the currently running bundle as healthy on native platforms so
 * @capgo/capacitor-updater will not auto-rollback on subsequent launches.
 */
export async function notifyOtaAppReady(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch {
    // Never block app boot if updater bridge is unavailable
  }
}

export async function getActiveAppVersion(): Promise<string> {
  let active = APP_VERSION;
  if (!isNativePlatform()) return active;

  try {
    const current = await CapacitorUpdater.current();
    if (
      current.native &&
      parseSemverParts(current.native) &&
      compareSemver(current.native, active) > 0
    ) {
      active = normalizeVersion(current.native);
    }
    if (
      current.bundle &&
      current.bundle.id !== 'builtin' &&
      current.bundle.version &&
      parseSemverParts(current.bundle.version) &&
      compareSemver(current.bundle.version, active) > 0
    ) {
      active = normalizeVersion(current.bundle.version);
    }
  } catch {
    // Fallback to static APP_VERSION
  }

  return active;
}

export async function fetchOtaManifest(
  manifestUrl: string = OTA_MANIFEST_URL
): Promise<OtaManifest> {
  const separator = manifestUrl.includes('?') ? '&' : '?';
  const requestUrl = `${manifestUrl}${separator}t=${Date.now()}`;

  let payload: unknown;

  if (isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url: requestUrl,
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Manifest request failed (${res.status})`);
    }
    payload = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  } else {
    const res = await fetch(requestUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Manifest request failed (${res.status})`);
    }
    payload = await res.json();
  }

  if (!isValidOtaManifest(payload)) {
    throw new Error('Invalid OTA manifest payload');
  }

  return {
    version: normalizeVersion(payload.version),
    url: payload.url.trim(),
    sha256: payload.sha256.trim().toLowerCase(),
    publishedAt: payload.publishedAt,
    notes: payload.notes,
  };
}

export interface CheckOtaOptions {
  applyImmediately?: boolean;
  manifestUrl?: string;
  fetcher?: () => Promise<OtaManifest>;
}

export async function checkForOtaUpdate(
  options?: CheckOtaOptions
): Promise<OtaCheckResult> {
  const currentVersion = await getActiveAppVersion();

  try {
    const manifest = options?.fetcher
      ? await options.fetcher()
      : await fetchOtaManifest(options?.manifestUrl ?? OTA_MANIFEST_URL);

    if (compareSemver(manifest.version, currentVersion) <= 0) {
      return {
        status: 'up-to-date',
        currentVersion,
        latestVersion: manifest.version,
        messageEn: `You are on the latest version (v${currentVersion}).`,
        messageDv: `ތިބާ ބޭނުންކުރައްވަނީ އެންމެ ފަހުގެ ވާޝަން (v${currentVersion}).`,
      };
    }

    if (!isNativePlatform()) {
      return {
        status: 'update-available-web',
        currentVersion,
        latestVersion: manifest.version,
        messageEn: `v${manifest.version} is available! Reload the web app to get the latest PWA bundle.`,
        messageDv: `v${manifest.version} ލިބެން އެބަހުރި! އެންމެ ފަހުގެ ވާޝަން ހޯދުމަށް ޕޭޖް ރީލޯޑްކޮށްލައްވާ.`,
      };
    }

    const existingList = await CapacitorUpdater.list();
    let bundle = existingList.bundles.find(
      (b) =>
        normalizeVersion(b.version) === manifest.version &&
        b.status !== 'error'
    );

    if (!bundle) {
      bundle = await CapacitorUpdater.download({
        url: manifest.url,
        version: manifest.version,
        checksum: manifest.sha256,
      });
    }

    await CapacitorUpdater.next({ id: bundle.id });

    if (options?.applyImmediately) {
      await CapacitorUpdater.set({ id: bundle.id });
    }

    return {
      status: 'downloaded',
      currentVersion,
      latestVersion: manifest.version,
      bundleId: bundle.id,
      messageEn: `Update v${manifest.version} downloaded! It will apply automatically on restart, or tap Apply Now.`,
      messageDv: `އަޕްޑޭޓް v${manifest.version} ޑައުންލޯޑްވެއްޖެ! އެޕް އަލުން ހުޅުވުމުން އަޅާނެ، ނުވަތަ "މިހާރު އަޕްޑޭޓް އަޅާ" އަށް ފިތާލައްވާ.`,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unable to reach update server.';
    return {
      status: 'error',
      currentVersion,
      messageEn: `Update check failed: ${detail}`,
      messageDv: `އަޕްޑޭޓް ޗެކްކުރުމުގައި މައްސަލައެއް: ${detail}`,
    };
  }
}

export async function applyDownloadedOtaBundle(bundleId: string): Promise<boolean> {
  if (!isNativePlatform() || !bundleId) return false;
  try {
    await CapacitorUpdater.set({ id: bundleId });
    return true;
  } catch {
    return false;
  }
}
