import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { statedLevel, scoreLevel, guessLevel, levelFromLabel } from '../src/difficulty.js';
import { factsFromHtml } from '../scripts/lib/jsonld.mjs';

test('reads the level a chef page states', () => {
  assert.equal(statedLevel('<span class="o-RecipeInfo__a-Headline">Level:</span>\n <span class="o-RecipeInfo__a-Description">Intermediate</span>'), 'medium');
  assert.equal(statedLevel('<div class="difficulty"><span>Not too tricky</span></div>'), 'easy');
  assert.equal(statedLevel('{"difficulty": "Advanced"}'), 'hard');
  assert.equal(statedLevel('<p>No level here</p>'), null);
  assert.equal(levelFromLabel('Showing off'), 'hard');
});

test('scores small, quick recipes easy and long technical ones hard', () => {
  assert.equal(scoreLevel({ ingredients: 5, steps: 3, minutes: 20, title: 'Tomato salad' }), 'easy');
  assert.equal(scoreLevel({ ingredients: 12, steps: 8, minutes: 90, title: 'Braised short ribs' }), 'medium');
  assert.equal(scoreLevel({ ingredients: 18, steps: 14, minutes: 240, method: 'Temper the chocolate. Laminate the dough and proof overnight.', title: 'Chocolate croissants' }), 'hard');
});

test('guesses a level from the title when the page gave nothing', () => {
  assert.equal(guessLevel('Beef Wellington', 180), 'hard');
  assert.equal(guessLevel('Simple green salad', 10), 'easy');
  assert.equal(guessLevel('Roast chicken', 90), 'medium');
});

test('collected facts carry a level but no recipe text', async () => {
  const html = await readFile(new URL('./fixtures/recipe-page.html', import.meta.url), 'utf8');
  const f = factsFromHtml(html);
  assert.ok(['easy', 'medium', 'hard'].includes(f.level));
  assert.ok(!('_steps' in f) && !('_ingredients' in f));
});

test('every recipe in the index has a level', async () => {
  const recipes = JSON.parse(await readFile(new URL('../public/data/recipes.json', import.meta.url), 'utf8'));
  for (const r of recipes) assert.ok(['easy', 'medium', 'hard'].includes(r.level), r.title);
});
