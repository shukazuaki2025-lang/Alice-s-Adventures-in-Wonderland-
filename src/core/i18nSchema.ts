import { z } from 'zod';

/**
 * Trilingual text string schema (English, Chinese, Japanese)
 */
export const LocalizedTextSchema = z.object({
  en: z.string().min(1, 'English text is required'),
  zh: z.string().min(1, 'Chinese text is required'),
  ja: z.string(),
});

/**
 * Subtitle / Dialogue entry schema
 */
export const DialogueEntrySchema = z.object({
  id: z.string().min(1),
  scene: z.enum(['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']),
  speaker: z.enum(['narrator', 'alice', 'rabbit', 'system']),
  type: z.enum(['say', 'think', 'narr', 'sfx', 'ui']),
  en: z.string().min(1, 'English text must be verbatim Carroll 1865 text'),
  zh: z.string()
    .min(1, 'Chinese text is required')
    .max(28, 'Chinese subtitle line must be <= 28 characters for Victorian picture-book formatting'),
  ja: z.string(),
  dur: z.number().positive('Duration must be positive'),
  audioSfx: z.string().optional(),
  note: z.string().optional(),
});

/**
 * Historical / Scientific curiosity note schema
 */
export const CuriosityNoteSchema = z.object({
  id: z.string().min(1),
  title: LocalizedTextSchema,
  triggerCondition: z.string().min(1),
  content: LocalizedTextSchema,
  historicalFact: LocalizedTextSchema,
  source: z.string().min(1),
});

/**
 * Two-tier stuck hint schema
 */
export const StuckHintPairSchema = z.object({
  tier1_60s: LocalizedTextSchema,
  tier2_120s: LocalizedTextSchema,
});

/**
 * Master Chapter 1 i18n Dataset Schema
 */
export const Chapter1I18nSchema = z.object({
  meta: z.object({
    chapter: z.string(),
    version: z.string(),
    source: z.string(),
  }),
  dialogues: z.record(z.string(), DialogueEntrySchema),
  curiosityNotes: z.record(z.string(), CuriosityNoteSchema),
  stuckHints: z.record(z.string(), StuckHintPairSchema),
  ui: z.record(z.string(), LocalizedTextSchema),
});

export type LocalizedText = z.infer<typeof LocalizedTextSchema>;
export type DialogueEntry = z.infer<typeof DialogueEntrySchema>;
export type CuriosityNote = z.infer<typeof CuriosityNoteSchema>;
export type StuckHintPair = z.infer<typeof StuckHintPairSchema>;
export type Chapter1I18n = z.infer<typeof Chapter1I18nSchema>;

/**
 * Validate Chapter 1 i18n JSON data against the schema
 */
export function validateChapter1I18n(data: unknown): Chapter1I18n {
  return Chapter1I18nSchema.parse(data);
}
