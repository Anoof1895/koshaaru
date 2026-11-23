// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  APP_VERSION,
  checkForOtaUpdate,
  compareSemver,
  isValidOtaManifest,
} from '../src/lib/otaUpdater.ts';

const SAMPLE_SHA256 = 'a'.repeat(64);

describe('Self-hosted OTA Updater helpers', () => {
  it('compares semantic versions accurately across v-prefixes and segments', () => {
    expect(compareSemver('1.0.2', '1.0.2')).toBe(0);
    expect(compareSemver('v1.0.3', '1.0.2')).toBe(1);
    expect(compareSemver('1.1.0', '1.0.9')).toBe(1);
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
    expect(compareSemver('1.0.1', '1.0.2')).toBe(-1);
    expect(compareSemver('invalid', '1.0.2')).toBe(0);
  });

  it('validates OTA manifest schema with strict https URL and 64-char sha256', () => {
    expect(
      isValidOtaManifest({
        version: '1.0.3',
        url: 'https://github.com/Anoof1895/koshaaru/releases/download/v1.0.3/ota-bundle.zip',
        sha256: SAMPLE_SHA256,
      })
    ).toBe(true);

    expect(
      isValidOtaManifest({
        version: '1.0.3',
        url: 'http://insecure.example.com/bundle.zip',
        sha256: SAMPLE_SHA256,
      })
    ).toBe(false);

    expect(
      isValidOtaManifest({
        version: '1.0.3',
        url: 'https://github.com/Anoof1895/koshaaru/releases/download/v1.0.3/ota-bundle.zip',
        sha256: 'short-checksum',
      })
    ).toBe(false);

    expect(isValidOtaManifest(null)).toBe(false);
  });

  it('reports up-to-date when manifest matches or is older than current version', async () => {
    const res = await checkForOtaUpdate({
      fetcher: async () => ({
        version: APP_VERSION,
        url: 'https://github.com/Anoof1895/koshaaru/releases/download/v1.0.2/ota-bundle.zip',
        sha256: SAMPLE_SHA256,
      }),
    });

    expect(res.status).toBe('up-to-date');
    expect(res.currentVersion).toBe(APP_VERSION);
    expect(res.messageEn).toContain(APP_VERSION);
  });

  it('reports update-available-web when a newer manifest exists on non-native web', async () => {
    const res = await checkForOtaUpdate({
      fetcher: async () => ({
        version: '1.0.9',
        url: 'https://github.com/Anoof1895/koshaaru/releases/download/v1.0.9/ota-bundle.zip',
        sha256: SAMPLE_SHA256,
      }),
    });

    expect(res.status).toBe('update-available-web');
    expect(res.latestVersion).toBe('1.0.9');
    expect(res.messageEn).toContain('1.0.9');
  });

  it('returns error result gracefully when manifest fetch throws', async () => {
    const res = await checkForOtaUpdate({
      fetcher: async () => {
        throw new Error('Network offline');
      },
    });

    expect(res.status).toBe('error');
    expect(res.messageEn).toContain('Network offline');
  });
});
