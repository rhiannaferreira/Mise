// Search and filtering for Mise. Pure functions so they can be tested without a browser.

export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Words people type that mean the same dish family.
const SYNONYMS = {
  noodles: 'pasta', spaghetti: 'pasta', macaroni: 'pasta', lasagne: 'lasagna', ragu: 'bolognese',
  prawn: 'shrimp', prawns: 'shrimp', fish: 'seafood', steak: 'beef', mince: 'beef',
  veggie: 'vegetarian', meatless: 'vegetarian',
};
const STOP = new Set(['recipe', 'recipes', 'a', 'an', 'the', 'with', 'and', 'best', 'how', 'to', 'make', 'for', 'something', 'some', 'dish', 'dishes', 'food']);

// Words that describe what kind of recipe you want rather than what's in it.
// "easy indian", "a challenging dessert", "spanish appetizers" all work.
const LEVEL_WORDS = {
  easy: 'easy', simple: 'easy', beginner: 'easy', weeknight: 'easy', effortless: 'easy',
  medium: 'medium', intermediate: 'medium',
  hard: 'hard', harder: 'hard', challenge: 'hard', challenging: 'hard', difficult: 'hard', advanced: 'hard',
  ambitious: 'hard', project: 'hard', impressive: 'hard', complex: 'hard', fancy: 'hard', showstopper: 'hard',
};
const CUISINE_WORDS = {
  italian: 'italian', american: 'american', southern: 'american', cajun: 'american', creole: 'american',
  french: 'french', mexican: 'mexican', latin: 'mexican', caribbean: 'mexican',
  asian: 'asian', indian: 'asian', thai: 'asian', japanese: 'asian', chinese: 'asian', korean: 'asian', vietnamese: 'asian',
  british: 'british', english: 'british', mediterranean: 'mediterranean', greek: 'mediterranean', spanish: 'mediterranean',
  moroccan: 'mediterranean', lebanese: 'mediterranean', middle: 'mediterranean', eastern: 'mediterranean',
};
const COURSE_WORDS = {
  appetizer: 'appetizers', appetizers: 'appetizers', starter: 'appetizers', starters: 'appetizers', snack: 'appetizers', snacks: 'appetizers', tapas: 'appetizers',
  dessert: 'desserts', desserts: 'desserts', sweet: 'desserts', sweets: 'desserts', baking: 'desserts', pudding: 'desserts',
  breakfast: 'breakfast', brunch: 'breakfast', soup: 'soups', soups: 'soups', stew: 'soups', stews: 'soups',
  side: 'sides', sides: 'sides', salad: 'sides', salads: 'sides', main: 'mains', mains: 'mains', entree: 'mains',
};


export function tokens(q) {
  return norm(q).split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w));
}

const stem = w => (w.length > 4 ? w.replace(/(es|s)$/, '') : w);

function fieldHas(field, w) {
  const s = stem(w);
  return field.includes(w) || field.includes(s);
}

export function score(recipe, chef, words) {
  if (!words.length) return 1;
  const title = norm(recipe.title);
  const tags = norm((Array.isArray(recipe.tags) ? recipe.tags : [recipe.tags]).join(' '));
  const who = norm(chef?.name);
  let total = 0;
  for (const w of words) {
    const alt = SYNONYMS[w];
    let best = 0;
    for (const v of alt ? [w, alt] : [w]) {
      if (fieldHas(title, v)) best = Math.max(best, v === w ? 5 : 3);
      else if (fieldHas(tags, v)) best = Math.max(best, v === w ? 3 : 2);
      else if (fieldHas(who, v)) best = Math.max(best, 2);
    }
    if (!best && LEVEL_WORDS[w] && recipe.level === LEVEL_WORDS[w]) best = 2;
    if (!best && CUISINE_WORDS[w] && recipe.cuisine === CUISINE_WORDS[w]) best = 2;
    if (!best && COURSE_WORDS[w] && recipe.course === COURSE_WORDS[w]) best = 2;
    if (!best) return 0; // every word has to match somewhere
    total += best;
  }
  if (recipe.rating) total += recipe.rating / 5;
  return total;
}

export function search(recipes, chefsById, { q = '', chefs = [], quick = false, video = false, course = '', cuisine = '', level = '' } = {}) {
  const words = tokens(q);
  const pick = new Set(chefs);
  const ranked = recipes
    .filter(r => !pick.size || pick.has(r.chef))
    .filter(r => !quick || (r.totalMinutes != null && r.totalMinutes <= 30) || norm(r.tags).includes('quick'))
    .filter(r => !video || r.hasVideo === true)
    .filter(r => !course || r.course === course)
    .filter(r => !cuisine || r.cuisine === cuisine)
    .filter(r => !level || r.level === level)
    .map(r => ({ r, s: score(r, chefsById[r.chef], words) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || (b.r.ratingCount ?? 0) - (a.r.ratingCount ?? 0) || a.r.title.localeCompare(b.r.title))
    .map(x => x.r);
  return words.length ? ranked : mixChefs(ranked, Object.keys(chefsById));
}

// Small stable hash so the default order looks varied but never jumps between visits.
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// With no search words, deal recipes out chef by chef (in roster order) so the first screen
// shows variety, leading with recipes that have a video.
export function mixChefs(list, chefOrder = []) {
  const piles = new Map(chefOrder.map(id => [id, []]));
  for (const r of list) (piles.get(r.chef) ?? piles.set(r.chef, []).get(r.chef)).push(r);
  for (const pile of piles.values()) pile.sort((a, b) => (b.hasVideo === true) - (a.hasVideo === true) || hash(a.title) - hash(b.title));
  const out = [];
  while (out.length < list.length) for (const pile of piles.values()) if (pile.length) out.push(pile.shift());
  return out;
}

export function formatMinutes(m) {
  if (m == null) return null;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}

// Fallback search on the open web, limited to the chefs' own pages.
export function webSearchUrl(dish, chefs) {
  const clauses = [];
  for (const c of chefs) {
    if (c.sources?.length) clauses.push(`site:${c.sources[0].host.replace(/^www\./, '')}${c.sources[0].pathPrefix.replace(/\/$/, '')}`);
    else clauses.push(`"${c.name}"`);
    if (clauses.length >= 12) break; // Google ignores words past about 32
  }
  return 'https://www.google.com/search?q=' + encodeURIComponent(`${dish} recipe (${clauses.join(' OR ')})`);
}

export const videoSearchUrl = (chefName, dish) =>
  'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${chefName} ${dish}`);
