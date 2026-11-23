// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  parseReminderTime,
  resolveBackButtonAction,
  syncDailyReminderNotification,
  syncNativeStatusBar,
} from '../src/lib/native.ts';
import { DEFAULT_SETTINGS } from '../src/storage/db.ts';

describe('Native Mobile UX & Capacitor Bridge Helpers', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#0D6E6E" />';
  });

  it('resolves Android hardware Back button actions in strict modal -> drawer -> Daily -> exit priority order', () => {
    // 1. Share modal takes highest priority
    expect(
      resolveBackButtonAction({
        hasShareModal: true,
        hasSettingsModal: true,
        hasInspectorDrawer: true,
        activeTab: 'dictionary',
      })
    ).toBe('close-share');

    // 2. Settings modal next
    expect(
      resolveBackButtonAction({
        hasShareModal: false,
        hasSettingsModal: true,
        hasInspectorDrawer: true,
        activeTab: 'games',
      })
    ).toBe('close-settings');

    // 3. WordInspectorDrawer next
    expect(
      resolveBackButtonAction({
        hasShareModal: false,
        hasSettingsModal: false,
        hasInspectorDrawer: true,
        activeTab: 'daily',
      })
    ).toBe('close-drawer');

    // 4. Non-daily tab navigates back to Daily
    expect(
      resolveBackButtonAction({
        hasShareModal: false,
        hasSettingsModal: false,
        hasInspectorDrawer: false,
        activeTab: 'review',
      })
    ).toBe('navigate-daily');

    // 5. Daily tab with no overlays exits the app
    expect(
      resolveBackButtonAction({
        hasShareModal: false,
        hasSettingsModal: false,
        hasInspectorDrawer: false,
        activeTab: 'daily',
      })
    ).toBe('exit-app');
  });

  it('parses and clamps 24-hour reminder time strings cleanly', () => {
    expect(parseReminderTime('09:00')).toEqual({ hour: 9, minute: 0 });
    expect(parseReminderTime('18:45')).toEqual({ hour: 18, minute: 45 });
    expect(parseReminderTime('invalid')).toEqual({ hour: 9, minute: 0 });
    expect(parseReminderTime('29:99')).toEqual({ hour: 23, minute: 59 });
  });

  it('syncs <meta name="theme-color"> with Light (#FAF7F2) and Dark (#0B161A) modes', async () => {
    await syncNativeStatusBar('dark');
    expect(
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
    ).toBe('#0B161A');

    await syncNativeStatusBar('light');
    expect(
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
    ).toBe('#FAF7F2');
  });

  it('provides localized status feedback when toggling daily reminder on web fallback', async () => {
    const enabledRes = await syncDailyReminderNotification(true, '08:30', 'en');
    expect(enabledRes.ok).toBe(true);
    expect(enabledRes.messageEn).toContain('08:30');
    expect(enabledRes.messageDv).toContain('08:30');

    const disabledRes = await syncDailyReminderNotification(false, '08:30', 'dv');
    expect(disabledRes.ok).toBe(true);
    expect(disabledRes.messageEn).toContain('turned off');
  });

  it('includes dailyReminderEnabled, dailyReminderTime, and topicsExpanded in DEFAULT_SETTINGS', () => {
    expect(DEFAULT_SETTINGS.dailyReminderEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.dailyReminderTime).toBe('09:00');
    expect(DEFAULT_SETTINGS.topicsExpanded).toBe(true);
  });
});
