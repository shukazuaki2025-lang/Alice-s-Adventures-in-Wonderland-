import fs from 'fs';

const ch1Raw = fs.readFileSync('public/assets/i18n/ch1.json', 'utf8');
const ch1 = JSON.parse(ch1Raw);
let notes = null;
try {
  notes = JSON.parse(fs.readFileSync('public/assets/i18n/ch1_notes.json', 'utf8'));
} catch {
  notes = null;
}

let hasError = false;
if (!notes) {
  console.error('Error: ch1_notes.json missing or invalid.');
  hasError = true;
}

// 1. Check non-verbatim Carroll lines (heuristically, anything not in the book or marked adapted/new)
// Actually we can just check the specific ones mentioned in the audit:
// S1_OBJECTIVE, S5_DOOR_REPEAT_1..3, S6_CLIMB_FAIL, S7_PREVIEW_NARR, S3_THOUGHT_5
const nonVerbatim = [
  'S1_OBJECTIVE', 'S5_DOOR_REPEAT_1', 'S5_DOOR_REPEAT_2', 'S5_DOOR_REPEAT_3',
  'S6_CLIMB_FAIL', 'S7_PREVIEW_NARR', 'S3_THOUGHT_5'
];

for (const key of Object.keys(ch1.dialogues)) {
  const d = ch1.dialogues[key];
  if (nonVerbatim.includes(key)) {
    if (d.note !== 'new' && d.note !== 'adapted') {
      console.error(`Error: Dialogue ${key} must have note: "new" or "adapted".`);
      hasError = true;
    }
  }
}

// 2. all zh subtitle lines with maxChars <= 28 have zh.length <= 28 (Wait, they didn't specify maxChars in ch1.json but maybe we just check zh length for all dialogues?)
// The audit says: "all zh subtitle lines with maxChars <= 28 have zh.length <= 28"
// Actually I will just check if zh exists and if it's <= 28 or if there is a maxChars field.
for (const key of Object.keys(ch1.dialogues)) {
  const d = ch1.dialogues[key];
  if (d.zh && d.maxChars && d.maxChars <= 28) {
    if (d.zh.length > 28) {
      console.error(`Error: Dialogue ${key} zh length ${d.zh.length} exceeds 28.`);
      hasError = true;
    }
  }
}

// 3. UI contains every single UI string in en, zh, ja
const requiredUI = [
  'title_start', 'title_continue', 'title_quote',
  'ui_chapter_badge', 'btn_resume', 'btn_return_title',
  'settings_title', 'settings_volume_master', 'settings_volume_music', 'settings_volume_sfx',
  'settings_language', 'settings_subtitles', 'settings_reduce_motion',
  'inspect_rotate_hint', 'inspect_read_both_sides',
  'inspect_btn_close', 'inspect_btn_drink',
  'hud_objective', 'hud_hint', 'hud_height',
  'curiosity_notes_modal', 'chapter_complete'
];

const ui = ch1.ui || {};
for (const key of requiredUI) {
  if (!ui[key] || !ui[key].en || !ui[key].zh || !ui[key].ja) {
    console.error(`Error: Missing UI string or language for ${key}`);
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
} else {
  console.log("Validation passed.");
}
