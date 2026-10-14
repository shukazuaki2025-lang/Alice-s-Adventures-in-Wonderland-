/**
 * Standardized Event Names for globalEventBus communication across Engine, UI, Audio, and Game
 */

export const GAME_EVENTS = {
  STATE_CHANGED: 'stateChanged',
  SCALE_CHANGED: 'scaleChanged',
  INVENTORY_UPDATED: 'inventoryUpdated',
  INSPECT_ITEM: 'inspectItem',
  DIALOGUE_TRIGGER: 'dialogueTrigger',
  SHOW_PROMPT: 'showPrompt',
  HIDE_PROMPT: 'hidePrompt',
  SHOW_CURIOSITY_NOTE: 'showCuriosityNote',
  SHOW_STUCK_HINT: 'showStuckHint',
  CHAPTER_COMPLETE: 'chapterComplete',
  CUTSCENE_START: 'cutsceneStart',
  CUTSCENE_END: 'cutsceneEnd',
  INTERACTION_TRIGGERED: 'interactionTriggered',
} as const;
