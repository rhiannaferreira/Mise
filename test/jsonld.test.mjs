import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { factsFromHtml, durationToMinutes } from '../scripts/lib/jsonld.mjs';

test('reads recipe facts from a page and skips broken blocks', async () => {
  const html = await readFile(new URL('./fixtures/recipe-page.html', import.meta.url), 'utf8');
  const f = factsFromHtml(html);
  assert.equal(f.title, 'Spaghetti alla Carbonara & Peas');
  assert.deepEqual(f.author, ['Anne Burrell']);
  assert.equal(f.totalMinutes, 30);
  assert.equal(f.rating, 4.7);
  assert.equal(f.ratingCount, 1203);
  assert.equal(f.hasVideo, true);
  assert.deepEqual(f.keywords, ['main-dish', 'italian', 'pasta', 'weeknight']);
});

test('never keeps ingredients or steps', async () => {
  const html = await readFile(new URL('./fixtures/recipe-page.html', import.meta.url), 'utf8');
  const f = factsFromHtml(html);
  assert.ok(!('recipeIngredient' in f) && !('recipeInstructions' in f));
  assert.ok(!JSON.stringify(f).includes('Boil water'));
});

test('returns null for pages without a recipe', () => {
  assert.equal(factsFromHtml('<script type="application/ld+json">{"@type":"Article"}</script>'), null);
});

test('converts ISO durations to minutes', () => {
  assert.equal(durationToMinutes('PT1H15M'), 75);
  assert.equal(durationToMinutes('PT45M'), 45);
  assert.equal(durationToMinutes('P0DT2H'), 120);
  assert.equal(durationToMinutes('PT0S'), null);
  assert.equal(durationToMinutes('soon'), null);
});
