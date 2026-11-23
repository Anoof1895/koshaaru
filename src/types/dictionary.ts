export type DialectTag =
  | 'addu'
  | 'fuvahmulah'
  | 'huvadhoo'
  | 'laamu'
  | 'lhaviyani'
  | 'haa'
  | 'archaic';

export type RegisterTag = 'honorific' | 'figurative' | 'proverb';

export type CategoryTag =
  | 'maritime'
  | 'marine'
  | 'flora'
  | 'food'
  | 'weather'
  | 'wildlife'
  | 'body_health'
  | 'culture_religion'
  | 'arts_games'
  | 'home_crafts'
  | 'clothing'
  | 'people_emotions';

export type InferredWordclass =
  | 'phrase_proverb'
  | 'verbal_masdhar'
  | 'abstract_kan'
  | null;

export interface DictionaryEntry {
  id: number;
  sourceIds: number[];
  headword: string;
  romanized: string;
  graphemeCount: number;
  wordclasses: string[];
  rawWordclasses: string[];
  inferredWordclass: InferredWordclass;
  senses: string[];
  enGloss?: string;
  enMeaning?: string;
  categories: CategoryTag[];
  dialects: DialectTag[];
  registers: RegisterTag[];
  synonymIds: number[];
  synonymOfIds: number[];
  explicitBaseIds: number[];
  familyIds: number[];
  familyRoot: string | null;
  referencedInCount: number;
  isCuratedDaily: boolean;
}

export interface GamePools {
  dailyCuratedIds: number[];
  deckPools: {
    honorific: number[];
    dialect: number[];
    figurative: number[];
    proverb: number[];
  };
  categoryPools?: Record<CategoryTag, number[]>;
  wordle4AnswerIds: number[];
  wordle4ValidIds: number[];
  clueChallengeIds: number[];
}

export interface PipelineReport {
  generatedAt: string;
  rawEntryCount: number;
  canonicalEntryCount: number;
  mergedDuplicateGroups: number;
  totalSenses: number;
  droppedEmptySenses: number;
  repairedLeadingParenSenses: number;
  repairedWordclassParens: number;
  normalizedWordclassTypos: number;
  unclassifiedWordclasses: number;
  inferredWordclasses: Record<string, number>;
  dialectCounts: Record<string, number>;
  registerCounts: Record<string, number>;
  synonymLinkCount: number;
  explicitBaseLinkCount: number;
  entriesWithFamily: number;
  totalCrossLinks: number;
  entriesWithCrossLinks: number;
  curatedDailyCount: number;
  wordle4AnswerCount: number;
  wordle4ValidCount: number;
  clueChallengeCount: number;
  englishTranslatedCount?: number;
  englishCoveragePct?: number;
  englishSources?: Record<string, number>;
  categorizedEntryCount?: number;
  categorizedCoveragePct?: number;
  dualCategoryEntryCount?: number;
  categoryCounts?: Record<CategoryTag, number>;
}

export type SearchMatchMode = 'any' | 'prefix' | 'suffix';

export interface SearchFilters {
  query: string;
  matchMode?: SearchMatchMode;
  category?: CategoryTag | '';
  wordclass: string; // '' = all, 'unclassified' = blank
  dialect: DialectTag | '';
  register: RegisterTag | '';
  hasFamily: boolean;
  hasSynonyms: boolean;
  searchInDefinitions: boolean;
  randomOrder?: boolean;
  randomSeed?: number;
}

export interface SearchResultItem {
  id: number;
  score: number;
  matchType:
    | 'exact'
    | 'prefix'
    | 'suffix'
    | 'romanized'
    | 'english'
    | 'contains'
    | 'definition'
    | 'reverse';
  snippet?: string;
}

export type UiLanguage = 'en' | 'dv';
export type ThemeMode = 'light' | 'dark';
export type DailyTarget = 1 | 3 | 5;
export type CoreDeckKey = 'curated' | 'honorific' | 'dialect' | 'figurative' | 'proverb';
export type TopicDeckKey = `topic:${CategoryTag}`;
export type DeckKey = CoreDeckKey | TopicDeckKey;

export interface UserSettings {
  dailyTarget: DailyTarget;
  activeDecks: DeckKey[];
  theme: ThemeMode;
  uiLanguage: UiLanguage;
  showRomanization: boolean;
  showEnglish: boolean;
  phoneticImeEnabled: boolean;
  dailyReminderEnabled?: boolean;
  dailyReminderTime?: string;
  topicsExpanded?: boolean;
}
