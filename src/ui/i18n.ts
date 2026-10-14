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

/**
 * Get localized string for a dialogue trigger entry
 */
export function getDialogueText(dialogueId: string, lang = currentLanguage): string {
  if (!currentI18nData || !currentI18nData.dialogues[dialogueId]) {
    return dialogueId;
  }
  const entry = currentI18nData.dialogues[dialogueId];
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
