import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

test('Chapter 1 i18n dataset exists and is valid JSON', () => {
  const jsonPath = path.join(projectRoot, 'public/assets/i18n/ch1.json');
  assert.strictEqual(fs.existsSync(jsonPath), true, 'ch1.json file should exist');

  const content = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(content);

  assert.ok(data.meta, 'meta section missing');
  assert.strictEqual(data.meta.chapter, 'Chapter I: Down the Rabbit-Hole');
  assert.ok(data.dialogues, 'dialogues section missing');
  assert.ok(data.curiosityNotes, 'curiosityNotes section missing');
  assert.ok(data.stuckHints, 'stuckHints section missing');
  assert.ok(data.ui, 'ui section missing');
});

test('All Chinese dialogue lines satisfy length constraint <= 28 chars', () => {
  const jsonPath = path.join(projectRoot, 'public/assets/i18n/ch1.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const dialogues = data.dialogues;
  for (const [id, entry] of Object.entries(dialogues)) {
    assert.ok(entry.zh, `Chinese line missing for dialogue ${id}`);
    assert.ok(
      entry.zh.length <= 28,
      `Dialogue ${id} Chinese text length (${entry.zh.length}) exceeds 28 character limit: "${entry.zh}"`
    );
  }
});

test('Contains mandatory historical/scientific curiosity notes with trigger conditions', () => {
  const jsonPath = path.join(projectRoot, 'public/assets/i18n/ch1.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const notes = data.curiosityNotes;
  assert.ok(notes.ch1_note_1, 'Tumbling stairs note missing');
  assert.ok(notes.ch1_note_2, '4000 miles / earth center fall note missing');
  assert.ok(notes.ch1_note_3, 'Latitude/Longitude note missing');
  assert.ok(notes.ch1_note_4, 'Antipathies note missing');
  assert.ok(notes.ch1_note_5, 'Dinah & Marmalade note missing');

  for (const [id, note] of Object.entries(notes)) {
    assert.ok(note.triggerCondition, `Trigger condition missing for note ${id}`);
    assert.ok(note.title.en && note.title.zh, `Title missing for note ${id}`);
    assert.ok(note.content.en && note.content.zh, `Content missing for note ${id}`);
  }
});

test('Contains two-tier stuck hints for puzzle states S1-S7', () => {
  const jsonPath = path.join(projectRoot, 'public/assets/i18n/ch1.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const hints = data.stuckHints;
  const expectedStates = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'];

  for (const state of expectedStates) {
    assert.ok(hints[state], `Stuck hint missing for state ${state}`);
    assert.ok(hints[state].tier1_60s.en, `Tier 1 EN hint missing for state ${state}`);
    assert.ok(hints[state].tier1_60s.zh, `Tier 1 ZH hint missing for state ${state}`);
    assert.ok(hints[state].tier2_120s.en, `Tier 2 EN hint missing for state ${state}`);
    assert.ok(hints[state].tier2_120s.zh, `Tier 2 ZH hint missing for state ${state}`);
  }
});
