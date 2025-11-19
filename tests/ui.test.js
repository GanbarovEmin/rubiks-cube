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

test('Hint workflow is surfaced in the UI copy and controls', () => {
  assert.match(html, /btn-hint/);
  assert.match(html, /Подсказка/);
  assert.match(html, /Нажмите «Подсказка»/);
});

test('Cube logic wires move counter, history tracking, and hint overlay', () => {
  assert.match(cubeSource, /let moveCount = 0/);
  assert.match(cubeSource, /function updateHintAvailability/);
  assert.match(cubeSource, /function showHintOverlay/);
  assert.match(cubeSource, /document\.getElementById\('btn-hint'\)/);
});

test('README documents the liquid glass UI and hint button', () => {
  assert.match(readme, /Liquid Glass/i);
  assert.match(readme, /Подсказка/);
  assert.match(readme, /move counter/i);
});
