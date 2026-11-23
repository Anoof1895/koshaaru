import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { UserSettings } from '../types/dictionary.ts';
import type { StoredSrsCard } from '../lib/fsrs.ts';
import type { DailyProgressState } from '../lib/dailyQueue.ts';
import type { TileStatus } from '../lib/wordle.ts';

export interface WordleGameRecord {
  dateKey: string;
  targetId: number;
  guesses: string[];
  evaluations: TileStatus[][];
  status: 'playing' | 'won' | 'lost';
}

export interface ClueGameRecord {
  dateKey: string;
  targetId: number;
  guesses: number[]; // candidate entryIds guessed
  revealedClues: number;
  status: 'playing' | 'won' | 'lost';
}

export interface GameStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayedDate: string | null;
}

export interface KnownWordRecord {
  entryId: number;
  markedAt: string;
}

interface DhivehiHubDB extends DBSchema {
  dict_cache: {
    key: string;
    value: { key: string; version: string; data: unknown };
  };
  srs_cards: {
    key: number;
    value: StoredSrsCard;
  };
  known_words: {
    key: number;
    value: KnownWordRecord;
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

export const DEFAULT_SETTINGS: UserSettings = {
  dailyTarget: 3,
  activeDecks: ['curated'],
  theme: 'light',
  uiLanguage: 'en',
  showRomanization: true,
  showEnglish: true,
  phoneticImeEnabled: false,
  dailyReminderEnabled: false,
  dailyReminderTime: '09:00',
  topicsExpanded: true,
};

export const DEFAULT_GAME_STATS: GameStats = {
  played: 0,
  won: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastPlayedDate: null,
};

let dbPromise: Promise<IDBPDatabase<DhivehiHubDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<DhivehiHubDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DhivehiHubDB>('dhivehi-language-hub-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('dict_cache')) {
          db.createObjectStore('dict_cache', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('srs_cards')) {
          db.createObjectStore('srs_cards', { keyPath: 'entryId' });
        }
        if (!db.objectStoreNames.contains('known_words')) {
          db.createObjectStore('known_words', { keyPath: 'entryId' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getCachedDictPart<T>(
  key: string,
  version: string
): Promise<T | null> {
  const db = await getDb();
  const row = await db.get('dict_cache', key);
  if (!row || row.version !== version) return null;
  return row.data as T;
}

export async function setCachedDictPart(
  key: string,
  version: string,
  data: unknown
): Promise<void> {
  const db = await getDb();
  await db.put('dict_cache', { key, version, data });
}

export async function getMetaValue<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.get('meta', key);
  return row ? (row.value as T) : null;
}

export async function setMetaValue(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put('meta', { key, value });
}

export async function getSettings(): Promise<UserSettings> {
  const saved = await getMetaValue<Partial<UserSettings>>('settings');
  const rawLang = (saved as { uiLanguage?: string } | null)?.uiLanguage;
  const merged = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
  if (merged.uiLanguage !== 'en' && merged.uiLanguage !== 'dv') {
    merged.uiLanguage = DEFAULT_SETTINGS.uiLanguage;
  }
  if (rawLang === 'dv-en') {
    await saveSettings(merged);
  }
  return merged;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await setMetaValue('settings', settings);
  try {
    localStorage.setItem('dhivehi_hub_theme', settings.theme);
    localStorage.setItem('dhivehi_hub_lang', settings.uiLanguage);
    localStorage.setItem(
      'dhivehi_hub_topics_expanded',
      String(settings.topicsExpanded ?? true)
    );
  } catch {
    // Ignore storage quota / private mode warnings
  }
}

export async function getAllSrsCards(): Promise<StoredSrsCard[]> {
  const db = await getDb();
  return db.getAll('srs_cards');
}

export async function putSrsCard(card: StoredSrsCard): Promise<void> {
  const db = await getDb();
  await db.put('srs_cards', card);
}

export async function deleteSrsCard(entryId: number): Promise<void> {
  const db = await getDb();
  await db.delete('srs_cards', entryId);
}

export async function getAllKnownWords(): Promise<KnownWordRecord[]> {
  const db = await getDb();
  return db.getAll('known_words');
}

export async function markWordKnown(entryId: number): Promise<void> {
  const db = await getDb();
  await db.put('known_words', {
    entryId,
    markedAt: new Date().toISOString(),
  });
  await db.delete('srs_cards', entryId);
}

export async function unmarkWordKnown(entryId: number): Promise<void> {
  const db = await getDb();
  await db.delete('known_words', entryId);
}

export async function getDailyProgress(): Promise<DailyProgressState | null> {
  return getMetaValue<DailyProgressState>('daily_progress');
}

export async function saveDailyProgress(state: DailyProgressState): Promise<void> {
  await setMetaValue('daily_progress', state);
}

export interface HubBackupPayload {
  version: number;
  exportedAt: string;
  settings: UserSettings;
  dailyProgress: DailyProgressState | null;
  srsCards: StoredSrsCard[];
  knownWords: KnownWordRecord[];
  metaRecords: Array<{ key: string; value: unknown }>;
}

export async function exportAllProgress(): Promise<HubBackupPayload> {
  const db = await getDb();
  const [settings, dailyProgress, srsCards, knownWords, metaRecords] =
    await Promise.all([
      getSettings(),
      getDailyProgress(),
      db.getAll('srs_cards'),
      db.getAll('known_words'),
      db.getAll('meta'),
    ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    dailyProgress,
    srsCards,
    knownWords,
    metaRecords,
  };
}

export async function importAllProgress(raw: unknown): Promise<void> {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid backup payload');
  }
  const data = raw as Partial<HubBackupPayload>;
  if (data.version !== 1 || !Array.isArray(data.srsCards) || !Array.isArray(data.knownWords)) {
    throw new Error('Unsupported backup format');
  }

  const db = await getDb();
  const tx = db.transaction(['srs_cards', 'known_words', 'meta'], 'readwrite');
  await tx.objectStore('srs_cards').clear();
  await tx.objectStore('known_words').clear();
  await tx.objectStore('meta').clear();

  for (const card of data.srsCards) {
    if (typeof card.entryId === 'number') {
      await tx.objectStore('srs_cards').put(card);
    }
  }
  for (const kw of data.knownWords) {
    if (typeof kw.entryId === 'number') {
      await tx.objectStore('known_words').put(kw);
    }
  }
  if (Array.isArray(data.metaRecords)) {
    for (const m of data.metaRecords) {
      if (m && typeof m.key === 'string') {
        await tx.objectStore('meta').put(m);
      }
    }
  }
  if (data.settings) {
    const importedSettings: UserSettings = {
      ...DEFAULT_SETTINGS,
      ...data.settings,
      uiLanguage:
        data.settings.uiLanguage === 'dv' ? 'dv' : DEFAULT_SETTINGS.uiLanguage,
    };
    await tx.objectStore('meta').put({ key: 'settings', value: importedSettings });
  }
  if (data.dailyProgress) {
    await tx.objectStore('meta').put({ key: 'daily_progress', value: data.dailyProgress });
  }
  await tx.done;

  if (data.settings?.theme || data.settings?.uiLanguage) {
    try {
      if (data.settings.theme) {
        localStorage.setItem('dhivehi_hub_theme', data.settings.theme);
      }
      if (data.settings.uiLanguage) {
        localStorage.setItem(
          'dhivehi_hub_lang',
          data.settings.uiLanguage === 'dv' ? 'dv' : 'en'
        );
      }
    } catch {
      // Ignore
    }
  }
}
