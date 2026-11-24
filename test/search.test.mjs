import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { search, tokens, formatMinutes, webSearchUrl } from '../src/search.js';
import { deriveTags } from '../scripts/lib/tags.mjs';

const chefs = JSON.parse(await readFile(new URL('../public/data/chefs.json', import.meta.url), 'utf8'));
const recipes = JSON.parse(await readFile(new URL('../public/data/recipes.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(chefs.map(c => [c.id, c]));

test('every recipe belongs to a known chef and links out over https', () => {
  for (const r of recipes) {
    assert.ok(byId[r.chef], `unknown chef ${r.chef}`);
    assert.match(r.url, /^https:\/\//);
  }
  assert.equal(new Set(recipes.map(r => r.url)).size, recipes.length, 'duplicate links');
});

test('carbonara finds only carbonara, title matches first', () => {
  const out = search(recipes, byId, { q: 'carbonara recipe' });
  assert.ok(out.length >= 4);
  assert.ok(out.every(r => /carbonara/i.test(r.title + r.tags)));
});

test('dish families and synonyms work', () => {
  assert.ok(search(recipes, byId, { q: 'spaghetti' }).some(r => r.title === 'Lemon Spaghetti'));
  assert.ok(search(recipes, byId, { q: 'pasta' }).length > 25);
  assert.ok(search(recipes, byId, { q: 'prawns' }).some(r => /shrimp/i.test(r.title)));
  assert.ok(search(recipes, byId, { q: 'Giada lemon' }).every(r => r.chef === 'giada'));
});

test('filters by chef and video', () => {
  assert.ok(search(recipes, byId, { chefs: ['ramsay'] }).every(r => r.chef === 'ramsay'));
  assert.ok(search(recipes, byId, { video: true }).every(r => r.hasVideo === true));
});

test('nonsense finds nothing', () => {
  assert.equal(search(recipes, byId, { q: 'zzqx' }).length, 0);
  assert.deepEqual(tokens('The best Easy RECIPE'), []);
});

test('formats times like a person would', () => {
  assert.equal(formatMinutes(25), '25 min');
  assert.equal(formatMinutes(60), '1 hr');
  assert.equal(formatMinutes(95), '1 hr 35 min');
  assert.equal(formatMinutes(null), null);
});

test('web fallback stays on the chefs’ own pages', () => {
  const url = decodeURIComponent(webSearchUrl('risotto', chefs));
  assert.match(url, /site:foodnetwork\.com\/recipes\/ina-garten/);
  assert.match(url, /"Missy Robbins"/);
  assert.ok(url.split(' OR ').length <= 12);
});

test('derives dish tags from titles', () => {
  assert.deepEqual(deriveTags('Bucatini with Clams').sort(), ['pasta', 'seafood']);
  assert.ok(deriveTags('Perfect Roast Chicken').includes('chicken'));
});

test('every craving shortcut finds a recipe', () => {
  for (const q of ['Carbonara', 'Chicken soup', 'Roast chicken', 'Burgers', 'Salmon', 'Curry', 'Mac and cheese', 'Bolognese', 'Steak', 'Brownies']) {
    const n = search(recipes, byId, { q }).length;
    assert.ok(n >= 1, `${q} found ${n}`);
  }
});

test('moods group recipes without a search word', async () => {
  const { MOODS } = await import('../src/search.js');
  for (const id of Object.keys(MOODS)) {
    const out = search(recipes, byId, { mood: id });
    assert.ok(out.length >= 2, `${id} found ${out.length}`);
  }
  assert.ok(search(recipes, byId, { mood: 'sweet' }).every(r => /dessert|brownie|pudding|budino/i.test(r.title + r.tags)));
});
