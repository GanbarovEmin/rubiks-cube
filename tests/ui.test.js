import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const html = readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const cubeSource = readFileSync(path.join(projectRoot, 'cube.js'), 'utf8');
const readme = readFileSync(path.join(projectRoot, 'README.md'), 'utf8');

test('HUD includes status, move counter, instructions, and UI controls', () => {
  assert.match(html, /id="status"/);
  assert.match(html, /id="move-counter"/);
  assert.match(html, /id="instructions"/);
  assert.match(html, /id="ui-container"/);
});

test('Shuffle difficulty selector lists easy, medium, and hard options', () => {
  assert.match(html, /id="shuffle-difficulty"/);
  assert.match(html, />Easy<\/option>/);
  assert.match(html, />Medium<\/option>/);
  assert.match(html, />Hard<\/option>/);
  assert.match(html, /shuffle-range-hint/);
});

test('Speed selector surfaces slow, normal, and fast presets', () => {
  assert.match(html, /id="speed-select"/);
  assert.match(html, />Slow<\/option>/);
  assert.match(html, />Normal<\/option>/);
  assert.match(html, />Fast<\/option>/);
  assert.match(cubeSource, /function setMoveSpeed/);
});

test('Move speed presets map to the expected durations', () => {
  assert.match(cubeSource, /MOVE_SPEEDS = {\s*slow: 550,/);
  assert.match(cubeSource, /normal: 350,/);
  assert.match(cubeSource, /fast: 150/);
});

test('Hint workflow is surfaced in the UI copy and controls', () => {
  assert.match(html, /btn-hint/);
  assert.match(html, /Подсказка/);
  assert.match(html, /Нажмите «Подсказка»/);
});

test('Reset control exists and cube logic exposes a reset helper', () => {
  assert.match(html, /btn-reset/);
  assert.match(cubeSource, /function resetCubeToSolved/);
});

test('Cube logic wires move counter, history tracking, and hint overlay', () => {
  assert.match(cubeSource, /let moveCount = 0/);
  assert.match(cubeSource, /function updateHintAvailability/);
  assert.match(cubeSource, /function showHintOverlay/);
  assert.match(cubeSource, /document\.getElementById\('btn-hint'\)/);
});

test('Shuffle move ranges cover easy, medium, and hard difficulties', () => {
  assert.match(cubeSource, /const SHUFFLE_MOVE_RANGES = {\s*easy: \[10, 15\]/);
  assert.match(cubeSource, /medium: \[20, 25\]/);
  assert.match(cubeSource, /hard: \[40, 45\]/);
});

test('README documents the liquid glass UI and hint button', () => {
  assert.match(readme, /Liquid Glass/i);
  assert.match(readme, /Подсказка/);
  assert.match(readme, /move counter/i);
});
