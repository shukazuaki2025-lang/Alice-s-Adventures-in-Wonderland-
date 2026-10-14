import { Chapter1I18n, validateChapter1I18n } from '../core/i18nSchema';
import { Language, globalEventBus } from '../core/types';

let currentI18nData: Chapter1I18n | null = null;
let currentLanguage: Language = 'zh'; // Default to Chinese or user preferred

export async function loadI18nData(url = '/assets/i18n/ch1.json'): Promise<Chapter1I18n> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch i18n data: ${res.status} ${res.statusText}`);
    }
    const rawData = await res.json();
    currentI18nData = validateChapter1I18n(rawData);
    console.log('[I18n] Successfully loaded and validated ch1.json dataset');
    return currentI18nData;
  } catch (err) {
    console.warn('[I18n] Could not fetch/validate external JSON, using fallback data:', err);
    if (!currentI18nData) {
      throw err;
    }
    return currentI18nData;
  }
}

export function setI18nData(data: Chapter1I18n): void {
  currentI18nData = validateChapter1I18n(data);
}

export function getI18nData(): Chapter1I18n | null {
  return currentI18nData;
}

export function setLanguage(lang: Language): void {
  if (currentLanguage !== lang) {
    currentLanguage = lang;
    globalEventBus.emit('languageChanged', lang);
  }
}

export function getLanguage(): Language {
  return currentLanguage;
}

const DIALOGUE_ID_ALIASES: Record<string, string> = {
  ch1_s1_01: 'S0_TITLE_NARR_1',
  ch1_s1_02: 'S1_PEEK_BOOK',
  ch1_s1_03: 'S1_IDLE',
  ch1_s1_04: 'S1_RABBIT_RUN',
  ch1_s2_01: 'S1_RABBIT_WATCH',
  ch1_s2_02: 'S2_JUMP',
  ch1_s3_01: 'S3_START',
  ch1_s3_02: 'S3_JAR_PICK',
  ch1_s3_03: 'S3_JAR_DROP_TRY',
  ch1_s3_04: 'S3_JAR_STORED',
  ch1_s3_05: 'S3_CURTSEY',
  ch1_s4_01: 'S4_CORNER',
  ch1_s5_01: 'S5_ENTER',
  ch1_s5_02: 'S5_TABLE',
  ch1_s5_03: 'S5_KEY_FAIL',
  ch1_s5_04: 'S5_CURTAIN_FOUND',
  ch1_s5_05: 'S5_PEEK',
  ch1_s6_01: 'S6_BOTTLE_APPEAR',
  ch1_s6_04: 'S6_SHRINK',
  ch1_s6_06: 'S6_CLIMB_FAIL',
  ch1_s7_01: 'S7_BOX_OPEN',
  ch1_s7_02: 'S7_EAT',
};

/**
 * Get localized string for a dialogue trigger entry
 */
export function getDialogueText(dialogueId: string, lang = currentLanguage): string {
  const resolvedId = DIALOGUE_ID_ALIASES[dialogueId] || dialogueId;
  if (!currentI18nData || !currentI18nData.dialogues[resolvedId]) {
    return dialogueId;
  }
  const entry = currentI18nData.dialogues[resolvedId];
  if (!entry) return dialogueId;

  const text = entry[lang];
  if (text && text.trim().length > 0) {
    return text;
  }
  // Fallback to English if localized string is empty (e.g. Japanese fallback)
  return entry.en;
}

/**
 * Get localized UI label
 */
export function getUIText(key: string, lang = currentLanguage): string {
  if (!currentI18nData || !currentI18nData.ui[key]) {
    return key;
  }
  const uiEntry = currentI18nData.ui[key];
  if (!uiEntry) return key;
  const text = uiEntry[lang];
  return (text && text.trim().length > 0) ? text : uiEntry.en;
}

/**
 * Get localized stuck hint
 */
export function getStuckHint(state: string, tier: 1 | 2, lang = currentLanguage) {
  if (!currentI18nData || !currentI18nData.stuckHints[state]) {
    return null;
  }
  const hintPair = currentI18nData.stuckHints[state];
  if (!hintPair) return null;
  const pair = tier === 1 ? hintPair.tier1_60s : hintPair.tier2_120s;
  return pair[lang] || pair.en;
}
