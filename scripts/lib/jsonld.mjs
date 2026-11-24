// Reads the schema.org Recipe data that recipe sites publish for search engines.
// We keep only facts about the recipe (name, time, rating, video, difficulty), never its text.
import { statedLevel, scoreLevel } from '../../src/difficulty.js';

const SCRIPT_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export function extractJsonLd(html) {
  const out = [];
  for (const m of html.matchAll(SCRIPT_RE)) {
    const raw = m[1].trim().replace(/^<!--|-->$/g, '');
    try { out.push(JSON.parse(raw)); } catch { /* skip malformed blocks */ }
  }
  return out;
}

function isRecipe(node) {
  const t = node && node['@type'];
  return Array.isArray(t) ? t.includes('Recipe') : t === 'Recipe';
}

export function findRecipe(blocks) {
  const stack = [...blocks];
  while (stack.length) {
    const n = stack.shift();
    if (!n || typeof n !== 'object') continue;
    if (Array.isArray(n)) { stack.push(...n); continue; }
    if (isRecipe(n)) return n;
    if (n['@graph']) stack.push(n['@graph']);
    if (n.mainEntity) stack.push(n.mainEntity);
  }
  return null;
}

// ISO 8601 duration such as PT1H15M -> 75
export function durationToMinutes(d) {
  if (typeof d !== 'string') return null;
  const m = d.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  const [, days, h, min] = m.map(x => (x ? Number(x) : 0));
  const total = days * 1440 + h * 60 + min;
  return total > 0 ? total : null;
}

const text = v => (Array.isArray(v) ? v : v == null ? [] : [v])
  .flatMap(x => (typeof x === 'string' ? x.split(',') : []))
  .map(s => s.trim()).filter(Boolean);

const decode = s => String(s)
  .replace(/&amp;/g, '&').replace(/&#39;|&#039;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

// Flattens recipeInstructions (a string, a list, HowToStep or HowToSection) into step texts.
export function stepTexts(v) {
  if (v == null) return [];
  if (typeof v === 'string') return v.split(/\n+|(?<=\.)\s+(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean);
  if (Array.isArray(v)) return v.flatMap(stepTexts);
  if (typeof v === 'object') {
    if (v.itemListElement) return stepTexts(v.itemListElement);
    if (v.text) return [String(v.text)];
    if (v.name) return [String(v.name)];
  }
  return [];
}

export function recipeFacts(recipe) {
  if (!recipe) return null;
  const total = durationToMinutes(recipe.totalTime)
    ?? ((durationToMinutes(recipe.prepTime) ?? 0) + (durationToMinutes(recipe.cookTime) ?? 0) || null);
  const r = recipe.aggregateRating || {};
  const rating = Number.parseFloat(r.ratingValue);
  const count = Number.parseInt(r.ratingCount ?? r.reviewCount, 10);
  const author = [].concat(recipe.author || []).map(a => (typeof a === 'string' ? a : a?.name)).filter(Boolean);
  return {
    title: recipe.name ? decode(recipe.name) : null,
    author: author.map(decode),
    totalMinutes: total,
    rating: Number.isFinite(rating) ? Math.round(rating * 10) / 10 : null,
    ratingCount: Number.isFinite(count) ? count : null,
    hasVideo: Boolean(recipe.video && (recipe.video.contentUrl || recipe.video.embedUrl || recipe.video.url || Array.isArray(recipe.video))),
    // Counted for the difficulty score, then dropped. Ingredients and steps are never kept.
    _ingredients: [].concat(recipe.recipeIngredient || recipe.ingredients || []).length,
    _steps: stepTexts(recipe.recipeInstructions),
    keywords: [...text(recipe.recipeCategory), ...text(recipe.recipeCuisine), ...text(recipe.keywords)].map(s => decode(s).toLowerCase()),
  };
}

export function factsFromHtml(html) {
  const raw = recipeFacts(findRecipe(extractJsonLd(html)));
  if (!raw) return null;
  const { _ingredients, _steps, ...facts } = raw;
  const scored = (_ingredients || _steps.length)
    ? scoreLevel({ ingredients: _ingredients, steps: _steps.length, minutes: facts.totalMinutes, method: _steps.join(' '), title: facts.title || '' })
    : null;
  facts.level = statedLevel(html) ?? scored;
  return facts;
}
